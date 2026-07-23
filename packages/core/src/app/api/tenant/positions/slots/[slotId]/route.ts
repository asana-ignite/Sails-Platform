import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

export async function PATCH(req: NextRequest, { params }: { params: { slotId: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await req.json();

    const slot = await db.positionSlot.findUnique({
      where: { id: params.slotId },
      include: { position: true }
    });

    if (!slot || slot.position.tenantId !== caller.tenantId) {
      return NextResponse.json({ error: 'Position Slot not found' }, { status: 404 });
    }

    // Update the slot assignment
    const updatedSlot = await db.positionSlot.update({
      where: { id: params.slotId },
      data: { userId: userId || null },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId: caller.tenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Assign Slot User',
      details: { slotId: params.slotId, userId: userId || null }
    });

    return NextResponse.json(updatedSlot, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
