import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * GET /api/tenant/teams
 * Returns all teams within the caller's tenant scope.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin role or specific capability
    if (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN') {
      // Actually we should check capability system.teams.manage here, 
      // but TENANT_ADMIN check aligns with other routes currently.
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;

    if (!targetTenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const teams = await db.team.findMany({
      where: { tenantId: targetTenantId },
      include: {
        parent: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, title: true }
            }
          }
        },
        positions: {
          include: {
            position: {
              include: {
                slots: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        systemPermissions: true,
        objectPermissions: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(teams);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/tenant/teams
 * Create a new team.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAppSession();
    const caller = session?.user as any;

    if (!caller || (caller.role !== 'SUPER_ADMIN' && caller.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetTenantId = caller.tenantId;
    if (!targetTenantId) {
       return NextResponse.json({ error: 'Could not determine tenant context.' }, { status: 400 });
    }

    const body = await req.json();
    const { name, parentId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const newTeam = await db.team.create({
      data: {
        name,
        tenantId: targetTenantId,
        parentId: parentId || null
      },
      include: {
        parent: true,
        members: { include: { user: true } },
        systemPermissions: true,
        objectPermissions: true
      }
    });

    SchemaLogger.logSystemEvent({
      tenantId: targetTenantId,
      userId: caller.id,
      category: 'USER_MANAGEMENT',
      action: 'CREATE',
      eventName: 'Create Team',
      details: { teamId: newTeam.id, name, parentId }
    });

    return NextResponse.json(newTeam, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
