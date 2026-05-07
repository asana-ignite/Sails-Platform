import { Pool } from 'pg';
import { db } from './src/lib/db';
import { AlchemaCore } from './src/core/engine/AlchemaCore';
import { TranslatorLayer } from './src/services/TranslatorLayer';
import { generateZodSchema } from './src/lib/zodGenerator';
import { QueryLayer } from './src/core/engine/QueryLayer';
import { TenantProvisioner } from './src/services/TenantProvisioner';

async function run() {
  console.log("🚀 Starting Complex Validation Test...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@host.docker.internal:5432/postgres'
  });
  
  const engine = new AlchemaCore(pool);
  const translator = new TranslatorLayer(engine);

  try {
    console.log("--- CLEANUP ---");
    await pool.query('DROP SCHEMA IF EXISTS tenant_val_test CASCADE');
    await db.tenant.deleteMany({ where: { schemaName: 'tenant_val_test' } });
    await db.auditLog.deleteMany({});
    await db.objectPermission.deleteMany({});
    await db.user.deleteMany({});
    await db.team.deleteMany({});

    // 1. Setup
    console.log("1. Setting up Test Tenant and Table...");
    const provisioner = new TenantProvisioner(pool);
    const provResult = await provisioner.provisionTenant("Validation Test Corp", "val@test.com");
    const tenant = provResult.tenant;
    const table = await translator.createTable(tenant.id, "Tasks", "tasks", "Task management");

    // 2. Add Enum Field
    console.log("\n2. Adding 'status' field with Enum constraint...");
    const field = await translator.addFieldDef(table.id, "Status", "status", "text", "select", null, true);
    
    // Add validation rule: ['To Do', 'In Progress', 'Done']
    const enumValues = ['To Do', 'In Progress', 'Done'];
    await translator.addValidationRule(field.id, 'enum', JSON.stringify(enumValues), "Invalid Status");
    console.log(`   ✅ Physical constraint added to 'tasks.status'.`);

    // 3. Test DB-level Enforcement
    console.log("\n3. Testing Database Enforcement...");
    
    const user = provResult.user;
    const team = provResult.adminTeam;
    await db.objectPermission.create({
      data: { teamId: team.id, objectName: 'tasks', canCreate: true }
    });

    try {
      console.log("   Attempting to insert 'InvalidStatus' into DB...");
      process.env.TEST_SESSION_JSON = JSON.stringify({
        user: { id: user.id, tenantId: tenant.id, role: 'TENANT_ADMIN', teamId: team.id }
      });
      await QueryLayer.insertRecord(pool, tenant.schemaName, 'tasks', { status: 'InvalidStatus' });
      console.error("   ❌ Error: Database should have rejected the insert!");
    } catch (e: any) {
      console.log(`   ✅ Success: Database rejected invalid value. Error: ${e.message}`);
    } finally {
      delete process.env.TEST_SESSION_JSON;
    }

    // 4. Test Application-level Enforcement (Zod)
    console.log("\n4. Testing Zod Generator Enforcement...");
    const fullTable = await db.tableDefinition.findUniqueOrThrow({
        where: { id: table.id },
        include: { fields: { include: { rules: true } } }
    });

    const zodSchema = generateZodSchema(fullTable.fields);
    
    const validData = { status: 'In Progress' };
    const invalidData = { status: 'Unknown' };

    const validResult = zodSchema.safeParse(validData);
    const invalidResult = zodSchema.safeParse(invalidData);

    if (validResult.success) {
        console.log(`   ✅ Success: Zod allowed valid value '${validData.status}'.`);
    } else {
        console.error("   ❌ Error: Zod rejected valid value!");
    }

    if (!invalidResult.success) {
        console.log(`   ✅ Success: Zod rejected invalid value '${invalidData.status}'.`);
        console.log(`      Error Message: ${invalidResult.error.errors[0].message}`);
    } else {
        console.error("   ❌ Error: Zod allowed invalid value!");
    }

    console.log("\n🎉 Complex Validation Test passed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    console.log("\n🧹 Cleaning up...");
    await pool.end();
    await db.$disconnect();
  }
}

run();
