import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { TenantProvisioner } from '../../../../services/TenantProvisioner';
import { requireAdmin } from '../../../../lib/auth/session';
import { PACKAGE_MANIFESTS } from '@sails/shared';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function GET() {
  try {
    const { tenantId } = await requireAdmin();
    const provisioner = new TenantProvisioner(pool);

    const activeIds = await provisioner.getActivePackages(tenantId);

    const packages = Object.entries(PACKAGE_MANIFESTS).map(([id, manifest]) => ({
      id,
      name: manifest.name,
      icon: manifest.icon,
      description: manifest.description,
      active: activeIds.includes(id),
      capabilityCount: manifest.capabilities.length,
    }));

    return NextResponse.json({ success: true, data: packages });
  } catch (error: any) {
    console.error('List Packages Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
