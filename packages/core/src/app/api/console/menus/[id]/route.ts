import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * GET /api/console/menus/[id]
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true, children: true }
    });

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });
    }

    // Security check
    if (caller && caller.role !== 'SUPER_ADMIN' && menu.app.tenantId !== caller.tenantId) {
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
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true }
    });

    if (!menu) return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });

    if (caller.role !== 'SUPER_ADMIN' && menu.app.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const updated = await db.consoleMenu.update({
      where: { id: params.id },
      data: {
        label: body.label,
        icon: body.icon,
        path: body.path,
        actionType: body.actionType,
        parentId: body.parentId,
        order: body.order,
        appId: body.appId // Moving to another app?
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/menus/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const menu = await db.consoleMenu.findUnique({
      where: { id: params.id },
      include: { app: true }
    });

    if (!menu) return NextResponse.json({ error: 'Menu not found.' }, { status: 404 });

    if (caller.role !== 'SUPER_ADMIN' && menu.app.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.consoleMenu.delete({ where: { id: params.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
