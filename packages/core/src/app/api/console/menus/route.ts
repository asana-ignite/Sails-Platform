/**
 * Sidebar menu CRUD (links, folders, ordering, visibility).
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';
import { invalidateConfigCache } from '@/lib/configCache';
import { normalizeMenuPath } from '@/lib/menuPaths';

async function findPathConflict(tenantId: string, path?: string | null, excludeId?: string) {
  if (!path || !path.trim()) return null;
  const normalized = normalizeMenuPath(path);
  if (!normalized) return null;

  const others = await db.consoleMenu.findMany({
    where: {
      app: { tenantId },
      path: { not: '' },
      id: excludeId ? { not: excludeId } : undefined
    },
    select: { id: true, label: true, path: true }
  });
  return others.find(m => normalizeMenuPath(m.path) === normalized) || null;
}

function validatePathFormat(path?: string | null): string | null {
  if (!path || !path.trim()) return null;
  if (!path.trim().startsWith('/')) return 'Browser Path must start with "/"';
  return null;
}

async function validateListViewMapping(tenantId: string, dataModelId?: string | null, listViewId?: string | null): Promise<string | null> {
  if (!listViewId) return null;
  if (!dataModelId) return 'List View requires a Data Model';
  const layout = await db.tableLayout.findFirst({
    where: {
      id: listViewId,
      tableId: dataModelId,
      table: { tenantId }
    },
    select: { id: true }
  });
  return layout ? null : 'List View does not belong to the selected Data Model';
}

function pathConflictError(path?: string | null, label?: string) {
  return NextResponse.json(
    { success: false, error: `Browser Path "${path?.trim()}" is already used by menu "${label}"` },
    { status: 409 }
  );
}

/**
 * GET /api/console/menus
 * Fetches the menu tree for a specific app or the whole tenant.
 */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireSession();
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId');

    const where: any = {
      app: { tenantId }
    };
    if (appId) where.appId = appId;

    const menus = await db.consoleMenu.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        children: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // We usually only want top-level menus if we are building a tree on the frontend,
    // but returning all is fine for the manager to reorganize.
    return NextResponse.json({ success: true, data: menus });
  } catch (error: any) {
    console.error('[API CONSOLE MENUS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/console/menus
 * Creates a new menu item.
 */
export async function POST(req: Request) {
  try {
    const { tenantId } = await requireSession();

    const body = await req.json();
    const { appId, label, icon, path, actionType, parentId, order, componentKey, requiredCapability, dataModelId, listViewId, labelI18n } = body;

    if (!appId || !label) {
      return NextResponse.json({ success: false, error: 'appId and label are required' }, { status: 400 });
    }

    // Verify app ownership
    const app = await db.consoleApp.findUnique({
      where: { id: appId, tenantId }
    });
    if (!app) {
      return NextResponse.json({ success: false, error: 'Application not found or access denied' }, { status: 404 });
    }

    const pathError = validatePathFormat(path);
    if (pathError) {
      return NextResponse.json({ success: false, error: pathError }, { status: 400 });
    }

    const conflict = await findPathConflict(tenantId, path);
    if (conflict) {
      return pathConflictError(path, conflict.label);
    }

    const viewError = await validateListViewMapping(tenantId, dataModelId, listViewId);
    if (viewError) {
      return NextResponse.json({ success: false, error: viewError }, { status: 400 });
    }

    const newMenu = await db.consoleMenu.create({
      data: {
        appId,
        tenantId: app.tenantId,
        label,
        icon,
        path,
        actionType: actionType || 'data_model',
        parentId,
        order: order || 0,
        componentKey,
        requiredCapability,
        dataModelId,
        listViewId,
        ...(labelI18n !== undefined ? { labelI18n } : {})
      }
    });

    invalidateConfigCache(tenantId);
    return NextResponse.json({ success: true, data: newMenu });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Browser Path is already used by another menu' }, { status: 409 });
    }
    console.error('[API CONSOLE MENUS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/console/menus
 * Updates a menu item (supports re-parenting and re-ordering).
 */
export async function PATCH(req: Request) {
  try {
    const { tenantId, role } = await requireSession();

    const body = await req.json();
    const { id, children: _children, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Menu ID is required' }, { status: 400 });
    }

    // Verify ownership through the associated app
    const existing = await db.consoleMenu.findFirst({
      where: { 
        id,
        app: { tenantId }
      }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Menu item not found or access denied' }, { status: 404 });
    }

    if (existing.isSystem && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System menu items are protected and can only be modified by Super Admins' }, { status: 403 });
    }

    const pathError = validatePathFormat(updateData.path);
    if (pathError) {
      return NextResponse.json({ success: false, error: pathError }, { status: 400 });
    }

    const conflict = await findPathConflict(tenantId, updateData.path, id);
    if (conflict) {
      return pathConflictError(updateData.path, conflict.label);
    }

    if (updateData.listViewId !== undefined) {
      const effectiveDataModelId = updateData.dataModelId ?? existing.dataModelId;
      const viewError = await validateListViewMapping(tenantId, effectiveDataModelId, updateData.listViewId);
      if (viewError) {
        return NextResponse.json({ success: false, error: viewError }, { status: 400 });
      }
    }

    const updatedMenu = await db.consoleMenu.update({
      where: { id },
      data: updateData
    });

    invalidateConfigCache(tenantId);
    return NextResponse.json({ success: true, data: updatedMenu });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Browser Path is already used by another menu' }, { status: 409 });
    }
    console.error('[API CONSOLE MENUS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/menus
 * Removes a menu item and promotes its children to the parent's level.
 */
export async function DELETE(req: Request) {
  try {
    const { tenantId, role } = await requireSession();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Menu ID is required' }, { status: 400 });
    }

    const existing = await db.consoleMenu.findFirst({
      where: { 
        id,
        app: { tenantId }
      }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Menu item not found or access denied' }, { status: 404 });
    }

    if (existing.isSystem && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System menu items are protected and can only be deleted by Super Admins' }, { status: 403 });
    }

    // Promote children to the grandparent level
    await db.consoleMenu.updateMany({
      where: { parentId: id },
      data: { parentId: existing.parentId ?? null }
    });

    await db.consoleMenu.delete({
      where: { id }
    });

    invalidateConfigCache(tenantId);
    return NextResponse.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error: any) {
    console.error('[API CONSOLE MENUS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
