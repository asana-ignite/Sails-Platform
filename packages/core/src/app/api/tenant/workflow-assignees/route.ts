import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

/**
 * GET /api/tenant/workflow-assignees
 * Lightweight option lists for the Task Approval "Assign To" picker:
 *  - roles      — distinct role values held by active users in the tenant
 *  - teams      — tenant teams (id + name)
 *  - positions  — tenant positions (id + name)
 *  - users      — active users (id + name + email)
 * The picker stores a reference (role name / team / position / user) which the
 * approval plugin resolves to CURRENT holders at task-creation time.
 */
export async function GET(_req: NextRequest) {
  try {
    const { tenantId } = await requireSession();

    const [users, teams, positions] = await Promise.all([
      db.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
      db.team.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.position.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const roles = Array.from(
      new Set(users.map((u) => u.role).filter((r): r is string => !!r)),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      roles,
      teams,
      positions,
      users: users.map(({ id, name, email }) => ({ id, name, email })),
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
