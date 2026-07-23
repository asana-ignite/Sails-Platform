import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, prefix, description, headCount } = await req.json();

    const existing = await db.position.findUnique({
      where: { id: params.id },
      include: { slots: true }
    });

    if (!existing || existing.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const updated = await db.position.update({
      where: { id: params.id },
      data: {
        name: name ?? existing.name,
        prefix: prefix ? prefix.toUpperCase() : existing.prefix,
        description: description !== undefined ? description : existing.description,
        headCount: headCount ?? existing.headCount
      }
    });

    // If headCount increased, create missing slots
    if (headCount && headCount > existing.slots.length) {
      const newPrefix = prefix ? prefix.toUpperCase() : existing.prefix;
      const additionalSlots = [];
      for (let i = existing.slots.length + 1; i <= headCount; i++) {
        additionalSlots.push({
          id: `${newPrefix}-${String(i).padStart(2, '0')}`,
          positionId: params.id
        });
      }
      if (additionalSlots.length > 0) {
        await db.positionSlot.createMany({ data: additionalSlots });
      }
    }

    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Update Position',
      details: { positionId: params.id, name: updated.name }
    });

    const fullPosition = await db.position.findUnique({
      where: { id: params.id },
      include: { slots: true }
    });

    return NextResponse.json(fullPosition, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const position = await db.position.findUnique({
      where: { id: params.id }
    });

    if (!position || position.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    await db.position.delete({
      where: { id: params.id }
    });

    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'DELETE',
      eventName: 'Delete Position',
      details: { positionId: params.id, name: position.name }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
