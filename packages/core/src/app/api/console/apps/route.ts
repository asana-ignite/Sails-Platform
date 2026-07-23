import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * GET /api/console/apps
 * Lists all console applications for the authenticated tenant.
 */
export async function GET() {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const apps = await db.consoleApp.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { menus: true }
        }
      }
    });

    return NextResponse.json({ success: true, data: apps });
  } catch (error: any) {
    console.error('[API CONSOLE APPS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/console/apps
 * Creates a new console application.
 */
export async function POST(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const body = await req.json();
    const { name, icon, order, requiredCapability } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'App name is required' }, { status: 400 });
    }

    const newApp = await db.consoleApp.create({
      data: {
        tenantId,
        name,
        icon: icon || 'Box',
        order: order || 0,
        requiredCapability
      }
    });

    return NextResponse.json({ success: true, data: newApp });
  } catch (error: any) {
    console.error('[API CONSOLE APPS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/console/apps
 * Updates an existing console application.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'App ID is required' }, { status: 400 });
    }

    // Ensure the app belongs to the tenant
    const existing = await db.consoleApp.findUnique({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'App not found or access denied' }, { status: 404 });
    }

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System applications are protected and can only be modified by Super Admins' }, { status: 403 });
    }

    const updatedApp = await db.consoleApp.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, data: updatedApp });
  } catch (error: any) {
    console.error('[API CONSOLE APPS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/apps
 * Removes a console application and its associated menus.
 */
export async function DELETE(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'App ID is required' }, { status: 400 });
    }

    // Ensure the app belongs to the tenant
    const existing = await db.consoleApp.findUnique({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'App not found or access denied' }, { status: 404 });
    }

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System applications are protected and can only be deleted by Super Admins' }, { status: 403 });
    }

    await db.consoleApp.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Application deleted successfully' });
  } catch (error: any) {
    console.error('[API CONSOLE APPS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
