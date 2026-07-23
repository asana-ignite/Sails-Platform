import { Pool } from 'pg';
import { db } from '../src/lib/db';
import { AlchemaCore } from '../src/core/engine/AlchemaCore';
import { QueryLayer } from '../src/core/engine/QueryLayer';
import { TenantProvisioner } from '../src/services/TenantProvisioner';
import { ConnectionManager } from '../src/core/engine/ConnectionManager';

// ─── Test Session Helpers ────────────────────────────────────────────────────
function setTestSession(userId: string, tenantId: string, role = 'MEMBER', teams?: { teamId: string, isLeader: boolean }[]) {
  process.env.TEST_SESSION_JSON = JSON.stringify({ user: { id: userId, tenantId, role, teams: teams ?? [] } });
}
function clearTestSession() { delete process.env.TEST_SESSION_JSON; }

async function run() {
  console.log("Connecting to PostgreSQL...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@host.docker.internal:5432/postgres'
  });
  
  // Initialize the ConnectionManager singleton
  ConnectionManager.initialize(pool, 'SCHEMA_PER_TENANT');

  const engine = new AlchemaCore(pool);

  try {
    console.log("--- CLEANUP ---");
    await pool.query('DROP SCHEMA IF EXISTS tenant_acme CASCADE');

    console.log("\n--- SCENARIO 1: Create Table & Constraints ---");
    console.log("1. Creating tenant schema 'tenant_acme'...");
    await engine.createTenantSchema('tenant_acme');
    console.log("   ✅ Schema created.");

    console.log("2. Creating table 'leads'...");
    await engine.createTable('tenant_acme', 'leads');
    console.log("   ✅ Table created.");

    console.log("3. Adding column 'email' to 'leads'...");
    await engine.addColumn('tenant_acme', 'leads', { name: 'email', type: 'text', isRequired: false });
    console.log("   ✅ Column added.");

    console.log("4. Adding CHECK constraint (regex) on 'email'...");
    await engine.addCheckConstraint('tenant_acme', 'leads', 'email_format_chk', 'email', 'regex', '^[^@]+@[^@]+\\.[^@]+$');
    console.log("   ✅ Constraint added.");

    console.log("\n--- SCENARIO 2: Modify Existing Columns ---");
    console.log("5. Adding new column 'phone_number'...");
    await engine.addColumn('tenant_acme', 'leads', { name: 'phone_number', type: 'text', isRequired: false });
    console.log("   ✅ Column 'phone_number' added.");

    console.log("6. Renaming column 'email' to 'work_email'...");
    await engine.renameColumn('tenant_acme', 'leads', 'email', 'work_email');
    console.log("   ✅ Column renamed.");

    console.log("7. Removing column 'phone_number'...");
    await engine.removeColumn('tenant_acme', 'leads', 'phone_number');
    console.log("   ✅ Column removed.");

    console.log("\n--- SCENARIO 3: Relation Columns ---");
    console.log("8. Creating table 'accounts'...");
    await engine.createTable('tenant_acme', 'accounts');
    console.log("   ✅ Table 'accounts' created.");
    
    console.log("9. Creating table 'contacts' with relation to 'accounts'...");
    await engine.createTable('tenant_acme', 'contacts', [
      { name: 'first_name', type: 'text', isRequired: true },
      { name: 'account_id', type: 'relation', relationTarget: 'accounts' }
    ]);
    console.log("   ✅ Table 'contacts' created with FOREIGN KEY to 'accounts'.");

    console.log("\n--- SCENARIO 4: RLS Data Insertion & Integrity ---");
    
    console.log("Setting up non-superuser role 'rls_user' for testing...");
    await pool.query('DROP OWNED BY rls_user CASCADE').catch(() => {});
    await pool.query('DROP ROLE IF EXISTS rls_user');
    await pool.query('CREATE ROLE rls_user NOLOGIN');
    await pool.query('GRANT USAGE ON SCHEMA tenant_acme TO rls_user');
    await pool.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_acme TO rls_user');
    
    // Grant SELECT/INSERT on core Prisma tables so the RLS policy can evaluate hierarchy and AuditTrail can write
    await pool.query('GRANT USAGE ON SCHEMA core TO rls_user');
    await pool.query('GRANT SELECT ON core.users TO rls_user');
    await pool.query('GRANT SELECT ON core.teams TO rls_user');
    await pool.query('GRANT SELECT ON core.user_teams TO rls_user');
    await pool.query('GRANT SELECT ON core.object_permissions TO rls_user');
    await pool.query('GRANT INSERT ON core.audit_logs TO rls_user');

    console.log("Setting up Users and Permissions in Prisma...");
    await db.dataAuditLog.deleteMany({});
    await db.objectPermission.deleteMany({});
    await db.user.deleteMany({});
    await db.team.deleteMany({});
    await db.tenant.deleteMany({});
    
    console.log("Provisioning Tenant A (Acme Corp)...");
    const provisioner = new TenantProvisioner(pool);
    const resultA = await provisioner.provisionTenant("Acme Corp", "usera@acme.com");
    const tenant = resultA.tenant;
    const teamA = resultA.adminTeam;
    const userA = resultA.user.id;
    console.log(`   ✅ Tenant A Provisioned with Schema: ${tenant.schemaName}`);

    console.log("Provisioning Tenant B (Acme Corp Duplicate Name Test)...");
    const resultDup = await provisioner.provisionTenant("Acme Corp", "dup@acme.com");
    console.log(`   ✅ Deduplication Test Passed! Schema created as: ${resultDup.tenant.schemaName}`);
    
    // We create another user under Tenant A for testing
    const teamB = await db.team.create({ data: { name: 'Team B', tenantId: tenant.id } });
    const userBObj = await db.user.create({ 
      data: { 
        email: 'userb@acme.com', 
        tenantId: tenant.id,
        teams: {
          create: { teamId: teamB.id, isLeader: false }
        }
      } 
    });
    const userB = userBObj.id;

    // Set Permissions
    await db.objectPermission.createMany({
      data: [
        { tenantId: tenant.id, teamId: teamA.id, objectName: 'accounts', canCreate: true, readScope: 'TEAM', },
        { tenantId: tenant.id, teamId: teamA.id, objectName: 'contacts', canCreate: true, readScope: 'TEAM', modifyScope: 'TEAM', },
        { tenantId: tenant.id, teamId: teamB.id, objectName: 'accounts', canCreate: false, readScope: 'TEAM', },
        { tenantId: tenant.id, teamId: teamB.id, objectName: 'contacts', canCreate: false, readScope: 'TEAM', }
      ]
    });

    // Inject User A session for all subsequent QueryLayer calls
    setTestSession(userA, tenant.id);

    console.log(`10. User A (${userA}) inserting data into 'accounts'...`);
    const account = await QueryLayer.insertRecord(pool, 'tenant_acme', 'accounts', {});
    const accountId = account.id;
    console.log(`   ✅ Account created by User A with ID: ${accountId}`);

    console.log(`11. User A inserting valid data into 'contacts'...`);
    const contact = await QueryLayer.insertRecord(
      pool, 'tenant_acme', 'contacts', { first_name: 'Alice', account_id: accountId }
    );
    console.log(`   ✅ Contact 'Alice' created by User A.`);

    console.log(`11.5. User A updating contact 'Alice'...`);
    await QueryLayer.updateRecord(pool, 'tenant_acme', 'contacts', contact.id, { first_name: 'Alice Smith' });
    console.log(`   ✅ Contact 'Alice' updated to 'Alice Smith'.`);

    // Switch to User B session for RLS block tests
    setTestSession(userB, tenant.id);

    console.log(`12. User B (${userB}) attempting to SELECT 'accounts' (RLS Block Test)...`);
    await QueryLayer.executeSecureQuery(pool, 'accounts', 'read', async (client) => {
      const result = await client.query(`SELECT * FROM tenant_acme.accounts`);
      if (result.rows.length > 0) {
        throw new Error("RLS Failed! User B was able to see User A's accounts.");
      }
      console.log(`   ✅ RLS successfully blocked User B from seeing User A's accounts! (Rows returned: ${result.rows.length})`);
    });

    console.log(`13. User B attempting to SELECT 'contacts' (RLS Block Test)...`);
    await QueryLayer.executeSecureQuery(pool, 'contacts', 'read', async (client) => {
      const result = await client.query(`SELECT * FROM tenant_acme.contacts`);
      if (result.rows.length > 0) {
        throw new Error("RLS Failed! User B was able to see User A's contacts.");
      }
      console.log(`   ✅ RLS successfully blocked User B from seeing User A's contacts! (Rows returned: ${result.rows.length})`);
    });

    console.log(`13.5. Checking Audit Logs...`);
    const logs = await db.dataAuditLog.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } });
    console.log(`   ✅ Found ${logs.length} audit logs!`);
    logs.forEach(log => {
      console.log(`      -> [${log.action}] on ${log.objectName} (Record: ${log.recordId})`);
    });
    if (logs.length !== 3) {
      throw new Error(`Expected 3 audit logs (2 inserts, 1 update), but found ${logs.length}`);
    }

    console.log("\n--- SCENARIO 5: Relation Column Removal ---");
    console.log("14. Removing 'account_id' relation column from 'contacts'...");
    await engine.removeColumn('tenant_acme', 'contacts', 'account_id');
    console.log("   ✅ Column 'account_id' and its FK constraints removed successfully.");

    console.log("\n🎉 All tests passed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    clearTestSession();
    await pool.end();
  }
}

run();
