/**
 * Single user update/delete.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

/**
 * GET /api/tenant/users/[id]
 * Fetches detailed profile, positions, teams, and data table access for a single user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, tenantId, role } = await requireSession();
    const { id } = params;

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        positionSlots: {
          include: {
            position: {
              include: {
                teamLinks: {
                  include: {
                    team: true
                  }
                }
              }
            }
          }
        },
        teams: {
          include: {
            team: true
          }
        },
        objectPermissions: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (role !== 'SUPER_ADMIN' && user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden: User outside tenant scope.' }, { status: 403 });
    }

    // Fetch tenant table definitions
    const tables = await db.tableDefinition.findMany({
      where: { tenantId: user.tenantId || tenantId },
      include: {
        fields: true
      }
    });

    const isSystemAdmin = user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN' || user.role === 'ADMIN';

    let tableAccessList = [];

    if (isSystemAdmin) {
      tableAccessList = tables.map(table => ({
        id: table.id,
        name: table.name,
        tableName: table.tableName,
        description: table.description,
        isSystem: table.isSystem,
        fieldCount: table.fields.length,
        isAccessible: true,
        canCreate: true,
        canDelete: true,
        readScope: 'ALL',
        modifyScope: 'ALL',
        source: 'ADMIN_ROLE'
      }));
    } else {
      // Resolve team IDs and position IDs for permissions calculation
      const explicitTeamIds = user.teams.map(t => t.teamId);
      const positionIds = user.positionSlots.map(ps => ps.position.id);
      const positionTeamIds = user.positionSlots.flatMap(ps => ps.position.teamLinks.map(tl => tl.teamId));
      const allTeamIds = Array.from(new Set([...explicitTeamIds, ...positionTeamIds]));

      // Fetch all object permissions linked to this user, their teams, or their positions
      const permissions = await db.objectPermission.findMany({
        where: {
          tenantId: user.tenantId || tenantId,
          OR: [
            { userId: user.id },
            { teamId: { in: allTeamIds } },
            { positionId: { in: positionIds } }
          ]
        }
      });

      const scopeRank: Record<string, number> = { 'NONE': 0, 'OWNER': 1, 'TEAM': 2, 'HIERARCHY': 3, 'ALL': 4 };
      const rankToScope = ['NONE', 'OWNER', 'TEAM', 'HIERARCHY', 'ALL'];

      tableAccessList = tables.map(table => {
        const tablePerms = permissions.filter(p => p.objectName === table.tableName || p.objectName === table.name);
        
        let maxReadRank = 0;
        let maxModifyRank = 0;
        let canCreate = false;
        let canDelete = false;

        tablePerms.forEach(p => {
          if ((scopeRank[p.readScope] || 0) > maxReadRank) maxReadRank = scopeRank[p.readScope] || 0;
          if ((scopeRank[p.modifyScope] || 0) > maxModifyRank) maxModifyRank = scopeRank[p.modifyScope] || 0;
          if (p.canCreate) canCreate = true;
          if (p.canDelete) canDelete = true;
        });

        const isAccessible = maxReadRank > 0 || maxModifyRank > 0 || canCreate || canDelete;

        return {
          id: table.id,
          name: table.name,
          tableName: table.tableName,
          description: table.description,
          isSystem: table.isSystem,
          fieldCount: table.fields.length,
          isAccessible,
          canCreate,
          canDelete,
          readScope: rankToScope[maxReadRank],
          modifyScope: rankToScope[maxModifyRank],
          source: tablePerms.length > 0 ? 'ASSIGNED_PERMISSIONS' : 'NONE'
        };
      });
    }

    const accessibleTablesCount = tableAccessList.filter(t => t.isAccessible).length;

    return NextResponse.json({
      ...user,
      accessibleTables: tableAccessList,
      accessibleTablesCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/tenant/users/[id]
 * Allows Admins to update user details within their tenant scope.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, tenantId, role: callerRole } = await requireSession();
    const { id } = params;

    // Verify Admin role
    if (callerRole !== 'SUPER_ADMIN' && callerRole !== 'TENANT_ADMIN' && callerRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, title, phone, isActive } = body;

    // 1. Fetch existing user to verify tenant ownership
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Security: Only allow updating users within the same tenant (unless SUPER_ADMIN)
    if (callerRole !== 'SUPER_ADMIN' && existingUser.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden: Cannot update users in other tenants.' }, { status: 403 });
    }

    // 2. Perform Update
    const updatedUser = await db.user.update({
      where: { id },
      data: {
        email: email !== undefined ? email : undefined,
        name: name !== undefined ? name : undefined,
        role: role !== undefined ? role : undefined,
        title: title !== undefined ? title : undefined,
        phone: phone !== undefined ? phone : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    SchemaLogger.logSystemEvent({
      tenantId: existingUser.tenantId || tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'UPDATE',
      eventName: 'Update User',
      details: {
        id,
        changes: { email, name, role, title, phone, isActive },
        before: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          title: existingUser.title,
          phone: existingUser.phone,
          isActive: existingUser.isActive
        }
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use by another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/users/[id]
 * Allows Admins to remove users from their tenant.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, tenantId, role } = await requireSession();
    const { id } = params;

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin role required.' }, { status: 403 });
    }

    const userToDelete = await db.user.findUnique({ where: { id } });
    if (!userToDelete) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (role !== 'SUPER_ADMIN' && userToDelete.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent self-deletion of the current admin
    if (userToDelete.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
    }

    await db.user.delete({ where: { id } });

    SchemaLogger.logSystemEvent({
      tenantId: userToDelete.tenantId || tenantId,
      userId,
      category: 'USER_MANAGEMENT',
      action: 'DELETE',
      eventName: 'Delete User',
      details: { id, email: userToDelete.email, name: userToDelete.name }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
