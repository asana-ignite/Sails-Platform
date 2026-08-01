import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

/**
 * GET /api/users/me
 * Retrieves current authenticated user context and granular object permissions.
 */
export async function GET() {
  try {
    const { userId, email, role, tenantId, teams } = await requireSession();
    const teamIds = teams.map((t) => t.teamId);

    // Fetch granular RBAC permissions across all teams the user belongs to
    const permissions = teamIds.length > 0
      ? await db.objectPermission.findMany({
          where: { teamId: { in: teamIds } }
        })
      : [];

    return NextResponse.json({
      user: { id: userId, email, role, tenantId, teams },
      permissions
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
