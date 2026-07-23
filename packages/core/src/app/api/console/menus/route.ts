import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * GET /api/console/menus
 * Fetches the menu tree for a specific app or the whole tenant.
 */
export async function GET(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

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
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { appId, label, icon, path, actionType, parentId, order, componentKey, requiredCapability } = body;

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

    const newMenu = await db.consoleMenu.create({
      data: {
        appId,
        label,
        icon,
        path,
        actionType: actionType || 'table',
        parentId,
        order: order || 0,
        componentKey,
        requiredCapability
      }
    });

    return NextResponse.json({ success: true, data: newMenu });
  } catch (error: any) {
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
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { id, ...updateData } = body;

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

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System menu items are protected and can only be modified by Super Admins' }, { status: 403 });
    }

    const updatedMenu = await db.consoleMenu.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, data: updatedMenu });
  } catch (error: any) {
    console.error('[API CONSOLE MENUS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/menus
 * Removes a menu item and its children.
 */
export async function DELETE(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

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

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System menu items are protected and can only be deleted by Super Admins' }, { status: 403 });
    }

    await db.consoleMenu.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error: any) {
    console.error('[API CONSOLE MENUS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
