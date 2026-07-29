import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get('appId');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const where: any = { tenantId };
    if (appId) where.appId = appId;

    const widgets = await db.consoleWidget.findMany({
      where,
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ success: true, data: widgets });
  } catch (error: any) {
    console.error('[API CONSOLE WIDGETS GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { appId, label, icon, componentKey, openIn, config, order, enabled, requiredCapability } = body;

    if (!label) {
      return NextResponse.json({ success: false, error: 'label is required' }, { status: 400 });
    }

    if (appId) {
      const app = await db.consoleApp.findUnique({
        where: { id: appId, tenantId }
      });
      if (!app) {
        return NextResponse.json({ success: false, error: 'Application not found or access denied' }, { status: 404 });
      }
    }

    const newWidget = await db.consoleWidget.create({
      data: {
        tenantId,
        appId: appId || null,
        label,
        icon,
        componentKey,
        openIn: openIn || 'bar',
        config: config || undefined,
        order: order || 0,
        enabled: enabled !== undefined ? enabled : true,
        requiredCapability
      }
    });

    return NextResponse.json({ success: true, data: newWidget });
  } catch (error: any) {
    console.error('[API CONSOLE WIDGETS POST]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Widget ID is required' }, { status: 400 });
    }

    const existing = await db.consoleWidget.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Widget not found or access denied' }, { status: 404 });
    }

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System widgets are protected and can only be modified by Super Admins' }, { status: 403 });
    }

    const updatedWidget = await db.consoleWidget.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, data: updatedWidget });
  } catch (error: any) {
    console.error('[API CONSOLE WIDGETS PATCH]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Widget ID is required' }, { status: 400 });
    }

    const existing = await db.consoleWidget.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Widget not found or access denied' }, { status: 404 });
    }

    const callerRole = (session?.user as any)?.role;
    if (existing.isSystem && callerRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'System widgets are protected and can only be deleted by Super Admins' }, { status: 403 });
    }

    await db.consoleWidget.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Widget deleted successfully' });
  } catch (error: any) {
    console.error('[API CONSOLE WIDGETS DELETE]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
