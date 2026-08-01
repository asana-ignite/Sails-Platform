import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * GET /api/tenant/teams
 * Returns all teams within the caller's tenant scope.
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireAdmin();

    const teams = await db.team.findMany({
      where: { tenantId },
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
    const { userId, tenantId } = await requireAdmin();

    const body = await req.json();
    const { name, parentId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
    }

    const newTeam = await db.team.create({
      data: {
        name,
        tenantId,
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
      tenantId,
      userId,
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
