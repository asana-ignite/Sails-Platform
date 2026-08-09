import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { TenantProvisioner } from '../../../../services/TenantProvisioner';
import { ProvisionTenantRequest } from '@sails/shared';
import { requireAdmin } from '../../../../lib/auth/session';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body: ProvisionTenantRequest = await request.json();
    const { name, adminEmail, existingUserId, password } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }
    if (!adminEmail && !existingUserId) {
      return NextResponse.json({ error: 'Provide either adminEmail (new user) or existingUserId (existing user)' }, { status: 400 });
    }
    if (!existingUserId && !password) {
      return NextResponse.json({ error: 'Password is required when creating a new admin user' }, { status: 400 });
    }

    const provisioner = new TenantProvisioner(pool);
    const result = await provisioner.provisionTenant(name, adminEmail, existingUserId, password);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Provisioning Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
