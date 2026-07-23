import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * DELETE /api/tenant/teams/[id]/members/[userId]
 * Remove a user from a team.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string, userId: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    const teamId = params.id;
    const userId = params.userId;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== targetTenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await db.userTeam.delete({
      where: {
        userId_teamId: { userId, teamId }
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId: targetTenantId,
      userId: caller.id,
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
