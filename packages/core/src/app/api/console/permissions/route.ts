import { NextResponse } from 'next/server';
import { SYSTEM_PERMISSION_REGISTRY } from '@/lib/security/registry';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

async function getMergedCapabilityDefinitions() {
  const pkgCaps = await db.capabilityDefinition.findMany({
    select: { key: true, label: true, description: true, category: true, packageId: true, isSystem: true }
  });
  const merged: Record<string, any> = {};
  for (const [key, def] of Object.entries(SYSTEM_PERMISSION_REGISTRY)) {
    merged[key] = { ...def, packageId: 'system', isSystem: true };
  }
  for (const cap of pkgCaps) {
    merged[cap.key] = {
      label: cap.label,
      description: cap.description || '',
      category: cap.category,
      packageId: cap.packageId,
      isSystem: cap.isSystem,
    };
  }
  return merged;
}

async function isValidCapability(key: string): Promise<boolean> {
  if (SYSTEM_PERMISSION_REGISTRY[key]) return true;
  const dbCap = await db.capabilityDefinition.findUnique({ where: { key } });
  return Boolean(dbCap);
}

/**
 * GET /api/console/permissions
 * Returns the full registry of available system + package capabilities.
 */
export async function GET() {
  try {
    const { role } = await requireSession();
    if (role !== 'SUPER_ADMIN' && role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }
    const merged = await getMergedCapabilityDefinitions();
    return NextResponse.json({ success: true, data: merged });
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

    if (!(await isValidCapability(capability))) {
      return NextResponse.json({ error: `Invalid capability key: ${capability}` }, { status: 400 });
    }

    const assignment = await db.systemPermission.upsert({
      where: { teamId_capability: { teamId, capability } },
      update: {},
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
      where: { teamId_capability: { teamId, capability } }
    });
    return NextResponse.json({ success: true, message: 'Capability revoked.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

