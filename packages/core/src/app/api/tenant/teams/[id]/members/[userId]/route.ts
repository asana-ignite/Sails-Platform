/**
 * Single team membership remove.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * DELETE /api/tenant/teams/[id]/members/[userId]
 * Remove a user from a team.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string, userId: string } }) {
  try {
    const { userId: callerId, tenantId } = await requireAdmin();
    const teamId = params.id;
    const userId = params.userId;

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await db.userTeam.delete({
      where: {
        userId_teamId: { userId, teamId }
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId: callerId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Remove Team Member',
      details: { teamId, targetUserId: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
