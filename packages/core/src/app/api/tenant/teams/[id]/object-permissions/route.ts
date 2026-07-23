import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * POST /api/tenant/teams/[id]/object-permissions
 * Upsert object permissions for a team.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;
    const teamId = params.id;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;

    const body = await req.json();
    const { objectName, canCreate, canRead, canUpdate, canDelete, viewAllData, modifyAllData } = body;

    if (!objectName) {
      return NextResponse.json({ error: 'objectName is required' }, { status: 400 });
    }

    // Verify team belongs to tenant
    const existingTeam = await db.team.findUnique({ where: { id: teamId } });
    if (!existingTeam || existingTeam.tenantId !== targetTenantId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const permission = await db.objectPermission.upsert({
      where: {
        teamId_objectName: { teamId, objectName }
      },
      update: {
        canCreate: canCreate ?? false,
        canRead: canRead ?? false,
        canUpdate: canUpdate ?? false,
        canDelete: canDelete ?? false,
        viewAllData: viewAllData ?? false,
        modifyAllData: modifyAllData ?? false
      },
      create: {
        teamId,
        objectName,
        canCreate: canCreate ?? false,
        canRead: canRead ?? false,
        canUpdate: canUpdate ?? false,
        canDelete: canDelete ?? false,
        viewAllData: viewAllData ?? false,
        modifyAllData: modifyAllData ?? false
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId: targetTenantId,
      userId: caller.id,
      category: 'SECURITY',
      action: 'UPDATE',
      eventName: 'Update Object Permission',
      details: { teamId, objectName, permissions: permission }
    });

    return NextResponse.json(permission, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
