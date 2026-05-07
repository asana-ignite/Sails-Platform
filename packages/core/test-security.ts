/**
 * test-security.ts
 *
 * Integration test suite for the KLAO Security Pipeline:
 *   Session → AccessGuard (RBAC) → TransactionContext (RLS) → QueryLayer (Audit)
 *
 * Run with:
 *   bun run test-security.ts
 *
 * No test framework required — uses the same run-as-script pattern as other tests.
 * Session injection is handled via TEST_SESSION_JSON (see src/lib/auth/session.ts).
 */

import { Pool } from 'pg';
import { db } from './src/lib/db';
import { QueryLayer } from './src/core/engine/QueryLayer';
import { AccessGuard } from './src/core/engine/AccessGuard';
import { TransactionContext } from './src/core/engine/TransactionContext';
import { AlchemaCore } from './src/core/engine/AlchemaCore';
import { TenantProvisioner } from './src/services/TenantProvisioner';
import { ConnectionManager } from './src/core/engine/ConnectionManager';

// ─── Session Helpers ──────────────────────────────────────────────────────────
function setSession(userId: string, tenantId: string, role = 'MEMBER', teams?: { teamId: string, isLeader: boolean }[], activeTeamId?: string) {
  process.env.TEST_SESSION_JSON = JSON.stringify({
    user: { id: userId, tenantId, role, teams: teams ?? [], activeTeamId }
  });
}
function clearSession() { delete process.env.TEST_SESSION_JSON; }

// ─── Assertion Helpers ────────────────────────────────────────────────────────
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function assertRejects(fn: () => Promise<any>, expectedMsg: string, label: string) {
  try {
    await fn();
    throw new Error(`Expected rejection but resolved — ${label}`);
  } catch (e: any) {
    if (e.message.startsWith('Expected rejection')) throw e;
    assert(
      e.message.includes(expectedMsg),
      `[${label}] Expected error containing "${expectedMsg}" but got: "${e.message}"`
    );
    console.log(`   ✅ Correctly rejected: "${e.message}"`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🔐 Starting KLAO Security Integration Tests\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://postgres:mysecretpassword@host.docker.internal:5432/postgres'
  });

  ConnectionManager.initialize(pool, 'SCHEMA_PER_TENANT');
  const engine = new AlchemaCore(pool);
  const provisioner = new TenantProvisioner(pool);

  let passed = 0;
  let failed = 0;

  // ── Global Cleanup ───────────────────────────────────────────────────────────
  console.log('--- CLEANUP ---');
  // Drop any schemas previously provisioned for these tenants
  const oldSchemas = await pool.query(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_security_corp%'`
  );
  for (const row of oldSchemas.rows) {
    await pool.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
  }
  await db.auditLog.deleteMany({});
  await db.objectPermission.deleteMany({});
  await db.account.deleteMany({});
  await db.session.deleteMany({});
  await db.user.deleteMany({});
  await db.team.deleteMany({});
  await db.tenant.deleteMany({});
  console.log('   ✅ Cleanup done.\n');

  // ── Provision Two Isolated Tenants ───────────────────────────────────────────
  console.log('--- SETUP: Provisioning two tenants ---');
  const resultA = await provisioner.provisionTenant('Security Corp A', 'admin-a@sec.com');
  const tenantA = resultA.tenant;
  const userA   = resultA.user;
  const profA   = resultA.adminTeam;
  console.log(`   ✅ Tenant A: ${tenantA.schemaName} | Admin: ${userA.email}`);

  const resultB = await provisioner.provisionTenant('Security Corp B', 'admin-b@sec.com');
  const tenantB = resultB.tenant;
  const userB   = resultB.user;
  console.log(`   ✅ Tenant B: ${tenantB.schemaName} | Admin: ${userB.email}`);

  // Create a member user in Tenant A (no teamId)
  const memberNoTeam = await db.user.create({
    data: { email: 'noteam@sec.com', tenantId: tenantA.id }
  });

  // Create a team with read-only access on 'leads' for Tenant A
  const readOnlyTeam = await db.team.create({
    data: { name: 'ReadOnly', tenantId: tenantA.id }
  });
  const readOnlyUser = await db.user.create({
    data: { 
      email: 'readonly@sec.com', 
      tenantId: tenantA.id, 
      teams: {
        create: { teamId: readOnlyTeam.id, isLeader: false }
      }
    }
  });
  await db.objectPermission.create({
    data: { teamId: readOnlyTeam.id, objectName: 'leads', canRead: true, canCreate: false }
  });

  // Create a leads table in Tenant A's schema using the dynamic engine
  // This ensures standard columns like owner_team_id and proper RLS policies are applied.
  await engine.createTable(tenantA.schemaName, 'leads', [{ name: 'title', type: 'text' }]);
  console.log(`   ✅ 'leads' table created in ${tenantA.schemaName}.\n`);

  // Grant DB-level permissions so rls_user can read core.* for RLS evaluation
  await pool.query('DROP OWNED BY rls_user CASCADE').catch(() => {});
  await pool.query('DROP ROLE IF EXISTS rls_user');
  await pool.query('CREATE ROLE rls_user NOLOGIN');
  await pool.query(`GRANT USAGE ON SCHEMA ${tenantA.schemaName} TO rls_user`);
  await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${tenantA.schemaName} TO rls_user`);
  await pool.query('GRANT USAGE ON SCHEMA core TO rls_user');
  await pool.query('GRANT SELECT ON core.users TO rls_user');
  await pool.query('GRANT SELECT ON core.teams TO rls_user');
  await pool.query('GRANT SELECT ON core.user_teams TO rls_user');
  await pool.query('GRANT SELECT ON core.object_permissions TO rls_user');
  await pool.query('GRANT INSERT ON core.audit_logs TO rls_user');

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: No Active Session → Unauthorized
  // ════════════════════════════════════════════════════════════════════════════
  console.log('--- SCENARIO 1: No Session → Unauthorized ---');
  try {
    clearSession();
    await assertRejects(
      () => AccessGuard.checkPermission('leads', 'read'),
      'No active session',
      'no session'
    );
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: SUPER_ADMIN Fast-Path (no DB lookup)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 2: SUPER_ADMIN Fast-Path ---');
  try {
    // Use a random userId — no team or permissions in DB at all
    setSession('00000000-0000-0000-0000-000000000001', tenantA.id, 'SUPER_ADMIN');
    await AccessGuard.checkPermission('any_table_that_does_not_exist', 'delete');
    console.log('   ✅ SUPER_ADMIN bypassed DB permission lookup correctly.');
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: No Team → Unauthorized
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 3: User Without Team → Unauthorized ---');
  try {
    setSession(memberNoTeam.id, tenantA.id, 'MEMBER');
    await assertRejects(
      () => AccessGuard.checkPermission('leads', 'read'),
      'has no team assigned',
      'no team'
    );
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: No Permission Record → Unauthorized
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 4: No objectPermission Record → Unauthorized ---');
  try {
    setSession(readOnlyUser.id, tenantA.id, 'MEMBER', [{ teamId: readOnlyTeam.id, isLeader: false }]);
    await assertRejects(
      () => AccessGuard.checkPermission('accounts', 'read'), // 'accounts' has no permission
      "No permissions found for object 'accounts'",
      'no permission record'
    );
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Wrong Action → Unauthorized (canRead=true, try canCreate)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 5: Wrong CRUD Action → Unauthorized ---');
  try {
    setSession(readOnlyUser.id, tenantA.id, 'MEMBER', [{ teamId: readOnlyTeam.id, isLeader: false }]);
    await assertRejects(
      () => AccessGuard.checkPermission('leads', 'create'), // canCreate=false
      "lacks 'create' permission",
      'wrong action'
    );
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: Cross-Tenant RLS Boundary (CRITICAL)
  //   Admin A inserts a record → Admin B's session sees 0 rows
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 6: Cross-Tenant RLS Boundary ---');
  try {
    // Ensure Tenant A admin has create permission
    await db.objectPermission.upsert({
      where: { teamId_objectName: { teamId: profA.id, objectName: 'leads' } },
      update: { canCreate: true, canRead: true },
      create: { teamId: profA.id, objectName: 'leads', canCreate: true, canRead: true }
    });

    // User A inserts a lead (runs as superuser, owner_id = userA.id)
    setSession(userA.id, tenantA.id, 'TENANT_ADMIN', [{ teamId: profA.id, isLeader: true }]);
    const lead = await QueryLayer.insertRecord(
      pool, tenantA.schemaName, 'leads', { title: 'Secret Lead' }
    );
    console.log(`   ✅ User A created lead: ${lead.id}`);

    // Switch to User B (different tenantId) — RLS policy checks owner_id vs app.current_user_id.
    // Run as rls_user so RLS is enforced (superusers bypass RLS by default).
    const rows = await TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        const r = await client.query(
          `SELECT * FROM "${tenantA.schemaName}".leads WHERE id = $1`,
          [lead.id]
        );
        return r.rows;
      },
      { userId: userB.id, tenantId: tenantB.id, role: 'rls_user' }
    );

    assert(rows.length === 0, 'RLS should return 0 rows for cross-tenant access!');
    console.log(`   ✅ RLS correctly hid Tenant A's lead from Tenant B (rows: ${rows.length}).`);
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Audit Log Atomicity — Failure Rolls Back Primary DML
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 7: Audit Atomicity — DML Rolls Back if Audit Fails ---');
  try {
    setSession(userA.id, tenantA.id, 'TENANT_ADMIN', [{ teamId: profA.id, isLeader: true }]);

    const countBefore = await pool.query(
      `SELECT COUNT(*) FROM "${tenantA.schemaName}".leads`
    );
    const rowsBefore = parseInt(countBefore.rows[0].count, 10);

    // Rename audit_logs table — breaks INSERT at DDL level for ALL connections (including superuser)
    await pool.query(`ALTER TABLE core.audit_logs RENAME TO audit_logs_disabled`);

    let insertError: Error | null = null;
    try {
      await QueryLayer.insertRecord(
        pool, tenantA.schemaName, 'leads', { title: 'Unaudited Lead' }
      );
    } catch (e: any) {
      insertError = e;
    }

    // Always restore the table name, even if assertions below fail
    await pool.query(`ALTER TABLE core.audit_logs_disabled RENAME TO audit_logs`);

    const countAfter = await pool.query(
      `SELECT COUNT(*) FROM "${tenantA.schemaName}".leads`
    );
    const rowsAfter = parseInt(countAfter.rows[0].count, 10);

    assert(insertError !== null, 'QueryLayer.insertRecord should have thrown when audit fails');
    assert(
      rowsAfter === rowsBefore,
      `Row count should be unchanged (was ${rowsBefore}, now ${rowsAfter}) — DML was NOT rolled back!`
    );
    console.log(`   ✅ Audit failure caused full transaction rollback. Row count unchanged: ${rowsAfter}.`);
    passed++;
  } catch (e: any) {
    // Safety net: ensure audit_logs is restored if something went wrong above
    await pool.query(`ALTER TABLE IF EXISTS core.audit_logs_disabled RENAME TO audit_logs`).catch(() => {});
    console.error(`   ❌ ${e.message}`);
    failed++;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: Team Queue Visibility
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n--- SCENARIO 8: Team Queue Visibility (Shared Team Ownership) ---');
  try {
    const teamQ = await db.team.create({ data: { name: 'QueueTeam', tenantId: tenantA.id } });
    await db.objectPermission.create({
      data: { teamId: teamQ.id, objectName: 'leads', canRead: true, canCreate: true }
    });
    const userA_q = await db.user.create({ data: { email: 'queue-a@sec.com', tenantId: tenantA.id } });
    await db.userTeam.create({ data: { userId: userA_q.id, teamId: teamQ.id } });
    
    const userB_q = await db.user.create({ data: { email: 'queue-b@sec.com', tenantId: tenantA.id } });
    await db.userTeam.create({ data: { userId: userB_q.id, teamId: teamQ.id } });

    const otherTeam = await db.team.create({ data: { name: 'OtherTeam', tenantId: tenantA.id } });
    const userC_q = await db.user.create({ data: { email: 'queue-c@sec.com', tenantId: tenantA.id } });
    await db.userTeam.create({ data: { userId: userC_q.id, teamId: otherTeam.id } });

    // User A inserts a lead belonging to Team Q
    setSession(userA_q.id, tenantA.id, 'MEMBER', [{ teamId: teamQ.id, isLeader: false }], teamQ.id);

    const lead = await QueryLayer.insertRecord(pool, tenantA.schemaName, 'leads', { title: 'Shared Ticket' });

    // User B (same team) should see it
    setSession(userB_q.id, tenantA.id, 'MEMBER', [{ teamId: teamQ.id, isLeader: false }], teamQ.id);

    const rowsForB = await TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        const res = await client.query(`SELECT * FROM "${tenantA.schemaName}".leads WHERE id = $1`, [lead.id]);
        return res.rows;
      },
      { userId: userB_q.id, tenantId: tenantA.id, role: 'rls_user', activeTeamId: teamQ.id }
    );
    assert(rowsForB.length === 1, 'User B in same team should see the team-owned record');

    // User C (different team) should NOT see it
    setSession(userC_q.id, tenantA.id, 'MEMBER', [{ teamId: otherTeam.id, isLeader: false }], otherTeam.id);

    const rowsForC = await TransactionContext.executeWithUserContext(
      pool,
      async (client) => {
        const res = await client.query(`SELECT * FROM "${tenantA.schemaName}".leads WHERE id = $1`, [lead.id]);
        return res.rows;
      },
      { userId: userC_q.id, tenantId: tenantA.id, role: 'rls_user', activeTeamId: otherTeam.id }
    );
    assert(rowsForC.length === 0, 'User C in different team should NOT see the record');

    console.log(`   ✅ Team Queue visibility correctly enforced.`);
    passed++;
  } catch (e: any) { console.error(`   ❌ ${e.message}`); failed++; }

  // ─── Results ─────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} scenarios`);
  if (failed === 0) {
    console.log('🎉 All security tests passed!');
  } else {
    console.log('❌ Some security tests failed. See errors above.');
    process.exit(1);
  }

  clearSession();
  await pool.end();
  await db.$disconnect();
}

run();
