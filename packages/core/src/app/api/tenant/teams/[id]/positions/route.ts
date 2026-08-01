import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * POST /api/tenant/teams/[id]/positions
 * Link a position to a team.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();

    const teamId = params.id;
    const body = await req.json();
    const { positionId } = body;

    if (!positionId) {
      return NextResponse.json({ error: 'positionId is required.' }, { status: 400 });
    }

    // Create TeamPosition relation if not existing
    const teamPosition = await db.teamPosition.upsert({
      where: {
        teamId_positionId: { teamId, positionId }
      },
      create: { teamId, positionId },
      update: {}
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Link Position to Team',
      details: { teamId, positionId }
    });

    return NextResponse.json(teamPosition, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/teams/[id]/positions
 * Unlink a position from a team.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();

    const teamId = params.id;
    const { searchParams } = new URL(req.url);
    const positionId = searchParams.get('positionId');

    if (!positionId) {
      return NextResponse.json({ error: 'positionId query parameter is required.' }, { status: 400 });
    }

    await db.teamPosition.delete({
      where: {
        teamId_positionId: { teamId, positionId }
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Unlink Position from Team',
      details: { teamId, positionId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
