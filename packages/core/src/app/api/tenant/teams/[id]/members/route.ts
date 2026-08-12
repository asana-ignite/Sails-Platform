/**
 * Team membership (add/remove users).
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * POST /api/tenant/teams/[id]/members
 * Add an existing user to a team.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId: callerId, tenantId } = await requireAdmin();
    const teamId = params.id;

    const body = await req.json();
    const { userId, userIds, isLeader } = body;

    const idsToAdd: string[] = userIds && Array.isArray(userIds) ? userIds : (userId ? [userId] : []);

    if (idsToAdd.length === 0) {
      return NextResponse.json({ error: 'userId or userIds array is required' }, { status: 400 });
    }

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const memberships = [];
    for (const targetUserId of idsToAdd) {
      const membership = await db.userTeam.upsert({
        where: {
          userId_teamId: { userId: targetUserId, teamId }
        },
        update: {
          isLeader: isLeader || false
        },
        create: {
          userId: targetUserId,
          teamId,
          isLeader: isLeader || false
        },
        include: {
          user: true
        }
      });
      memberships.push(membership);
    }

    SchemaLogger.logSystemEvent({
      tenantId,
      userId: callerId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Add Team Members',
      details: { teamId, targetUserIds: idsToAdd, isLeader }
    });

    return NextResponse.json({ success: true, count: memberships.length, members: memberships }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
