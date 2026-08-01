import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * PATCH /api/tenant/teams/[id]
 * Update a team's name or parent.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const teamId = params.id;

    const body = await req.json();
    const { name, parentId } = body;

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const updatedTeam = await db.team.update({
      where: { id: teamId },
      data: {
        ...(name && { name }),
        ...(parentId !== undefined && { parentId })
      },
      include: {
        parent: true,
        members: { include: { user: true } },
        systemPermissions: true,
        objectPermissions: true
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Update Team',
      details: { teamId, name, parentId }
    });

    return NextResponse.json(updatedTeam);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/teams/[id]
 * Delete a team.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const teamId = params.id;

    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (existingTeam.isSystemAdmin) {
      return NextResponse.json({ error: 'Cannot delete the system admin team.' }, { status: 400 });
    }

    await db.team.delete({
      where: { id: teamId }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'DELETE',
      eventName: 'Delete Team',
      details: { teamId, name: existingTeam.name }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
