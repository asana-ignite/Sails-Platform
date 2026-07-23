import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';
import { AccessGuard } from '@/core/engine/AccessGuard';

export async function GET(req: NextRequest) {
  try {
    const session = await getAppSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = session.user.tenantId;

    const positions = await db.position.findMany({
      where: { tenantId },
      include: {
        slots: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        teamLinks: true
      },
      orderBy: { prefix: 'asc' }
    });

    return NextResponse.json(positions, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, prefix, description, headCount } = await req.json();

    if (!name || !prefix || headCount < 1) {
      return NextResponse.json({ error: 'Missing required fields or invalid head count' }, { status: 400 });
    }

    const position = await db.position.create({
      data: {
        tenantId: caller.tenantId,
        name,
        prefix,
        description,
        headCount
      }
    });

    // Auto-generate slots
    const slots = [];
    for (let i = 1; i <= headCount; i++) {
      slots.push({
        id: `${prefix}-${String(i).padStart(2, '0')}`,
        positionId: position.id
      });
    }

    if (slots.length > 0) {
      await db.positionSlot.createMany({ data: slots });
    }

    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'CREATE',
      eventName: 'Create Position',
      details: { positionId: position.id, name, headCount }
    });

    const fullPosition = await db.position.findUnique({
      where: { id: position.id },
      include: { slots: true }
    });

    return NextResponse.json(fullPosition, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A position with this prefix already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
