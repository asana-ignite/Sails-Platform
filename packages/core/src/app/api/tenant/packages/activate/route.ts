import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { TenantProvisioner } from '../../../../../services/TenantProvisioner';
import { requireAdmin } from '../../../../../lib/auth/session';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const { packageId } = await request.json();

    if (!packageId) {
      return NextResponse.json({ error: 'Missing required field: packageId' }, { status: 400 });
    }

    const provisioner = new TenantProvisioner(pool);

    await provisioner.seedPackageCapabilityDefinitions(packageId);
    await provisioner.activatePackage(session.tenantId!, packageId);

    const activePackages = await provisioner.getActivePackages(session.tenantId!);
    return NextResponse.json({ success: true, activePackages });
  } catch (error: any) {
    console.error('Package Activation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
