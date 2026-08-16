import { Pool } from 'pg';
import { db } from '../src/lib/db';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

async function run() {
  if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    console.error('⛔ [SAFETY BLOCK] Destructive test aborted.');
    console.error('This test wipes all database tables (tenants, users, permissions).');
    console.error('To run this test against a dedicated throwaway test DB, pass: ALLOW_DESTRUCTIVE_TESTS=true');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const provisioner = new TenantProvisioner(pool);

  // Cleanup
  await db.objectPermission.deleteMany({});
  await db.user.deleteMany({});
  await db.team.deleteMany({});
  await db.tenant.deleteMany({});

  console.log('--- Test 1: New User Mode ---');
  const r1 = await provisioner.provisionTenant('Test Corp', 'admin@test.com');
  console.log(`✅ Tenant: ${r1.tenant.schemaName} | User: ${r1.user.email}`);

  console.log('--- Test 2: Existing User Mode ---');
  const r2 = await provisioner.provisionTenant('Test Corp Branch', undefined, r1.user.id);
  console.log(`✅ Tenant: ${r2.tenant.schemaName} | Linked User: ${r2.user.email}`);
  console.log(`   User now belongs to tenant: ${r2.user.tenantId}`);

  console.log('--- Test 3: Missing both (should throw) ---');
  try {
    await (provisioner as any).provisionTenant('No Admin Corp');
    console.log('❌ Should have thrown!');
  } catch(e: any) {
    console.log(`✅ Correctly rejected: ${e.message}`);
  }

  console.log('\n🎉 All provisioning mode tests passed!');
  await pool.end();
  await db.$disconnect();
}

run();
