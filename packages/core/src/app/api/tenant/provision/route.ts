import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { TenantProvisioner } from '../../../../services/TenantProvisioner';
import { ProvisionTenantRequest } from '@inidos/shared';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function POST(request: Request) {
  try {
    const body: ProvisionTenantRequest = await request.json();
    const { name, adminEmail, existingUserId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }
    if (!adminEmail && !existingUserId) {
      return NextResponse.json({ error: 'Provide either adminEmail (new user) or existingUserId (existing user)' }, { status: 400 });
    }

    const provisioner = new TenantProvisioner(pool);
    const result = await provisioner.provisionTenant(name, adminEmail, existingUserId);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Provisioning Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
