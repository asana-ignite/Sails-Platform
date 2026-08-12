/**
 * AccessGuard — object-level (RBAC) authorization for dynamic tables.
 *
 * Every QueryLayer operation starts here: it checks the session's role
 * against the table's object_permissions (via core metadata) BEFORE any
 * SQL runs. Record-level filtering is layered on top by TransactionContext
 * (RLS). Together: "can this user operate on this table at all" (this
 * module) + "which rows may they see" (RLS).
 */
import { db } from '../../lib/db';
import { getSession } from '@/lib/auth/session';

export type CrudAction = 'create' | 'read' | 'update' | 'delete';

export class AccessGuard {
  /**
   * Checks if a user has the appropriate object-level permission for an action.
   * Throws an error if unauthorized.
   */
  static async checkPermission(objectName: string, action: CrudAction, options?: { userId?: string, jwtRole?: string }): Promise<void> {
    let resolvedUserId = options?.userId;
    let resolvedRole = options?.jwtRole;

    if (!resolvedUserId) {
      const ctx = await getSession();
      if (ctx) {
        resolvedUserId = ctx.userId;
        resolvedRole = ctx.role || resolvedRole;
      }
    }

    if (!resolvedUserId) {
      throw new Error(`Unauthorized: No active session or user context provided.`);
    }

    if (resolvedRole === 'SUPER_ADMIN' || resolvedRole === 'TENANT_ADMIN') {
      return; // Fast path for system and tenant admins based on JWT role
    }

    const user = await db.user.findUnique({
      where: { id: resolvedUserId },
      select: { 
        teams: {
          select: { teamId: true }
        },
        positionSlots: {
          select: {
            position: {
              select: {
                id: true,
                teamLinks: { select: { teamId: true } }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error(`Unauthorized: User ${resolvedUserId} not found.`);
    }

    const explicitTeamIds = user.teams.map(t => t.teamId);
    const positionIds = user.positionSlots.map(ps => ps.position.id);
    const positionTeamIds = user.positionSlots.flatMap(ps => ps.position.teamLinks.map(tl => tl.teamId));
    
    const allTeamIds = Array.from(new Set([...explicitTeamIds, ...positionTeamIds]));

    const permissions = await db.objectPermission.findMany({
      where: {
        objectName: objectName,
        OR: [
          { teamId: { in: allTeamIds } },
          { positionId: { in: positionIds } },
          { userId: resolvedUserId }
        ]
      }
    });

    if (permissions.length === 0) {
      throw new Error(`Unauthorized: No permissions found for object '${objectName}'.`);
    }

    // Check specific CRUD action across all permissions (additive)
    let hasPermission = false;
    
    if (action === 'read') {
      hasPermission = permissions.some(p => p.readScope !== 'NONE');
    } else if (action === 'update') {
      hasPermission = permissions.some(p => p.modifyScope !== 'NONE');
    } else if (action === 'create') {
      hasPermission = permissions.some(p => p.canCreate);
    } else if (action === 'delete') {
      hasPermission = permissions.some(p => p.canDelete);
    }

    if (!hasPermission) {
      throw new Error(`Unauthorized: User lacks '${action}' permission for object '${objectName}'.`);
    }
  }

  /**
   * Checks if a user has a specific functional system capability.
   * Used for filtering UI components and protecting admin API routes.
   */
  static async hasCapability(capability: string): Promise<boolean> {
    const ctx = await getSession();

    if (!ctx) return false;

    // Platform & Tenant Admins always have all capabilities
    if (ctx.role === 'SUPER_ADMIN' || ctx.role === 'TENANT_ADMIN') {
      return true;
    }

    // Regular users must have the capability assigned to one of their teams
    const teamIds = ctx.teams.map((t) => t.teamId);
    if (teamIds.length === 0) return false;

    const permission = await db.systemPermission.findFirst({
      where: {
        teamId: { in: teamIds },
        capability
      }
    });

    return !!permission;
  }
}

