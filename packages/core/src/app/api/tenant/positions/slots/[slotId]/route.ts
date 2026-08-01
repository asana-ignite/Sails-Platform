import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

export async function PATCH(req: NextRequest, { params }: { params: { slotId: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();

    const { userId: slotUserId } = await req.json();

    const slot = await db.positionSlot.findUnique({
      where: { id: params.slotId },
      include: { position: true }
    });

    if (!slot || slot.position.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Position Slot not found' }, { status: 404 });
    }

    // Update the slot assignment
    const updatedSlot = await db.positionSlot.update({
      where: { id: params.slotId },
      data: { userId: slotUserId || null },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Assign Slot User',
      details: { slotId: params.slotId, userId: slotUserId || null }
    });

    return NextResponse.json(updatedSlot, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
