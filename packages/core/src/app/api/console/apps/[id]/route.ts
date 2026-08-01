import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

/**
 * GET /api/console/apps/[id]
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    const app = await db.consoleApp.findUnique({
      where: { id: params.id },
      include: { menus: true }
    });

    if (!app) {
      return NextResponse.json({ error: 'App not found.' }, { status: 404 });
    }

    if (role !== 'SUPER_ADMIN' && app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(app);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/console/apps/[id]
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = await db.consoleApp.findUnique({ where: { id: params.id } });
    if (!app) return NextResponse.json({ error: 'App not found.' }, { status: 404 });

    if (role !== 'SUPER_ADMIN' && app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (app.isSystem && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'System applications are protected and can only be modified by Super Admins' }, { status: 403 });
    }

    const body = await req.json();
    const updated = await db.consoleApp.update({
      where: { id: params.id },
      data: {
        name: body.name,
        icon: body.icon,
        order: body.order
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/apps/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = await db.consoleApp.findUnique({ where: { id: params.id } });
    if (!app) return NextResponse.json({ error: 'App not found.' }, { status: 404 });

    if (role !== 'SUPER_ADMIN' && app.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (app.isSystem && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'System applications are protected and can only be deleted by Super Admins' }, { status: 403 });
    }

    await db.consoleApp.delete({ where: { id: params.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
