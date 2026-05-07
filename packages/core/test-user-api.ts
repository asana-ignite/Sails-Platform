import { GET as getMe } from './src/app/api/users/me/route';
import { POST as createUser } from './src/app/api/tenant/users/route';
import { db } from './src/lib/db';
import { NextRequest } from 'next/server';

async function runTests() {
  console.log('🔐 Starting User Management API Tests\n');

  // 1. Cleanup
  await db.user.deleteMany({ where: { email: { in: ['new-user@test.com', 'admin@test.com'] } } });
  const tenant = await db.tenant.create({
    data: { name: 'API Test Corp', schemaName: 'tenant_api_test' }
  });
  const team = await db.team.create({
    data: { name: 'Test Team', tenantId: tenant.id }
  });
  await db.objectPermission.create({
    data: { teamId: team.id, objectName: 'leads', canRead: true }
  });

  const adminUser = await db.user.create({
    data: {
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
      teams: {
        create: { teamId: team.id, isLeader: true }
      }
    }
  });

  // --- SCENARIO 1: GET /api/users/me ---
  console.log('--- SCENARIO 1: GET /api/users/me ---');
  process.env.TEST_SESSION_JSON = JSON.stringify({
    user: { 
      id: adminUser.id, 
      email: adminUser.email, 
      role: adminUser.role, 
      tenantId: adminUser.tenantId, 
      teams: [{ teamId: team.id, isLeader: true }]
    }
  });

  const meResponse = await getMe();
  const meData = await meResponse.json();

  if (meResponse.status === 200 && meData.user.email === 'admin@test.com' && meData.permissions.length > 0) {
    console.log('✅ GET /me returned correct user and permissions.');
  } else {
    console.error('❌ GET /me failed:', meData);
  }

  // --- SCENARIO 2: POST /api/tenant/users (Success) ---
  console.log('\n--- SCENARIO 2: POST /api/tenant/users (Success) ---');
  const postReq = new NextRequest('http://localhost/api/tenant/users', {
    method: 'POST',
    body: JSON.stringify({
      email: 'new-user@test.com',
      name: 'New User',
      role: 'MEMBER',
      teamId: team.id
    })
  });

  const createResponse = await createUser(postReq);
  const createData = await createResponse.json();

  if (createResponse.status === 201 && createData.tenantId === tenant.id) {
    console.log('✅ User provisioned correctly within the admin\'s tenant.');
  } else {
    console.error('❌ User provisioning failed:', createData);
  }

  // --- SCENARIO 3: POST /api/tenant/users (Forbidden) ---
  console.log('\n--- SCENARIO 3: POST /api/tenant/users (Forbidden) ---');
  process.env.TEST_SESSION_JSON = JSON.stringify({
    user: { id: createData.id, email: createData.email, role: 'MEMBER', tenantId: tenant.id }
  });

  const forbiddenReq = new NextRequest('http://localhost/api/tenant/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'attacker@test.com', name: 'Attacker' })
  });

  const forbiddenResponse = await createUser(forbiddenReq);
  if (forbiddenResponse.status === 403) {
    console.log('✅ Correctly rejected unauthorized provisioning attempt.');
  } else {
    console.error('❌ Security breach: Member was able to provision users!');
  }

  // Cleanup
  console.log('\n--- CLEANUP ---');
  await db.objectPermission.deleteMany({ where: { teamId: team.id } });
  await db.user.deleteMany({ where: { tenantId: tenant.id } });
  await db.team.deleteMany({ where: { tenantId: tenant.id } });
  await db.tenant.delete({ where: { id: tenant.id } });
  console.log('✅ Cleanup done.');

  console.log('\n🎉 User API tests complete.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('💥 Test Suite Crashed:', err);
  process.exit(1);
});
