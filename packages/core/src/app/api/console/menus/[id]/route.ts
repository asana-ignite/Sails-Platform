/**
 * Sidebar menu item update/delete.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';
import { normalizeMenuPath } from '@/lib/menuPaths';

/**
 * GET /api/console/menus/[id]
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true, children: true }
    });

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });
    }

    if (role !== 'SUPER_ADMIN' && menu.app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(menu);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/console/menus/[id]
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true }
    });

    if (!menu) return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });

    if (role !== 'SUPER_ADMIN' && menu.app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const pathError = (() => {
      if (!body.path || !body.path.trim()) return null;
      if (!body.path.trim().startsWith('/')) return 'Browser Path must start with "/"';
      return null;
    })();
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 400 });
    }

    if (body.path && body.path.trim()) {
      const normalized = normalizeMenuPath(body.path);
      const others = await db.consoleMenu.findMany({
        where: {
          app: { tenantId },
          path: { not: '' },
          id: { not: params.id }
        },
        select: { id: true, label: true, path: true }
      });
      const conflict = others.find(m => normalizeMenuPath(m.path) === normalized);
      if (conflict) {
        return NextResponse.json(
          { error: `Browser Path "${body.path.trim()}" is already used by menu "${conflict.label}"` },
          { status: 409 }
        );
      }
    }

    let targetAppTenantId: string | undefined;
    if (body.appId && body.appId !== menu.appId) {
      const targetApp = await db.consoleApp.findUnique({ where: { id: body.appId }, select: { tenantId: true } });
      if (!targetApp || (role !== 'SUPER_ADMIN' && targetApp.tenantId !== tenantId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      targetAppTenantId = targetApp.tenantId;
    }

    const updated = await db.consoleMenu.update({
      where: { id: params.id },
      data: {
        label: body.label,
        icon: body.icon,
        path: body.path,
        actionType: body.actionType,
        parentId: body.parentId,
        order: body.order,
        appId: body.appId, // Moving to another app?
        tenantId: targetAppTenantId
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Browser Path is already used by another menu' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/menus/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true }
    });

    if (!menu) return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });

    if (role !== 'SUPER_ADMIN' && menu.app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.consoleMenu.delete({ where: { id: params.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
