/**
 * Object permissions granted via a team.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * POST /api/tenant/teams/[id]/object-permissions
 * Upsert object permissions for a team.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, tenantId } = await requireAdmin();
    const teamId = params.id;

    const { objectName, canCreate, canDelete, readScope, modifyScope } = await req.json();

    if (!objectName) {
      return NextResponse.json({ error: 'objectName is required' }, { status: 400 });
    }

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const permission = await db.objectPermission.upsert({
      where: {
        teamId_objectName: { teamId, objectName }
      },
      update: {
        tenantId,
        canCreate: canCreate ?? false,
        canDelete: canDelete ?? false,
        readScope: readScope ?? 'NONE',
        modifyScope: modifyScope ?? 'NONE'
      },
      create: {
        tenantId,
        teamId,
        objectName,
        canCreate: canCreate ?? false,
        canDelete: canDelete ?? false,
        readScope: readScope ?? 'NONE',
        modifyScope: modifyScope ?? 'NONE'
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId,
      userId,
      category: 'SETTINGS',
      action: 'UPDATE',
      eventName: 'Update Object Permission',
      details: { teamId, objectName, permissions: permission }
    });

    return NextResponse.json(permission, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
