import { NextResponse } from 'next/server';
import { SYSTEM_PERMISSION_REGISTRY } from '@/lib/security/registry';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

/**
 * GET /api/console/permissions
 * Returns the full registry of available system capabilities.
 * Used by the Admin UI to render permission management screens.
 */
export async function GET() {
  try {
    const { role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: SYSTEM_PERMISSION_REGISTRY
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/console/permissions
 * Assigns a system capability to a team.
 */
export async function POST(req: Request) {
  try {
    const { role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { teamId, capability } = await req.json();

    if (!teamId || !capability) {
      return NextResponse.json({ error: 'Missing teamId or capability' }, { status: 400 });
    }

    // Verify capability exists in registry
    if (!SYSTEM_PERMISSION_REGISTRY[capability]) {
      return NextResponse.json({ error: `Invalid capability key: ${capability}` }, { status: 400 });
    }

    const assignment = await db.systemPermission.upsert({
      where: {
        teamId_capability: { teamId, capability }
      },
      update: {}, // No change if exists
      create: { teamId, capability }
    });

    return NextResponse.json({ success: true, data: assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/console/permissions
 * Revokes a system capability from a team.
 */
export async function DELETE(req: Request) {
  try {
    const { role } = await requireSession();

    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { teamId, capability } = await req.json();

    await db.systemPermission.delete({
      where: {
        teamId_capability: { teamId, capability }
      }
    });

    return NextResponse.json({ success: true, message: 'Capability revoked.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

