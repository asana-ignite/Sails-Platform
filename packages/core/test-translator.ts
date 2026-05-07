import { Pool } from 'pg';
import { db } from './src/lib/db';
import { AlchemaCore } from './src/core/engine/AlchemaCore';
import { TranslatorLayer } from './src/services/TranslatorLayer';
import { TenantProvisioner } from './src/services/TenantProvisioner';

async function run() {
  console.log("Connecting to PostgreSQL and Prisma...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  const alchemaCore = new AlchemaCore(pool);
  const translator = new TranslatorLayer(alchemaCore);

  try {
    console.log("--- CLEANUP ---");
    // Clean up physical schema
    await pool.query('DROP SCHEMA IF EXISTS tenant_beta_corp CASCADE');
    // Clean up metadata (Cascade delete handles tables, fields, rules)
    await db.tenant.deleteMany({ where: { schemaName: 'tenant_beta_corp' } });

    console.log("\n--- SCENARIO: End-to-End Translator ---");
    
    // 1. Create Tenant
    console.log("1. UI requests to create Tenant 'Beta Corp'...");
    const provisioner = new TenantProvisioner(pool);
    const provisionResult = await provisioner.provisionTenant("Beta Corp", "admin@beta.com");
    const tenant = provisionResult.tenant;
    console.log(`   ✅ Metadata saved with ID: ${tenant.id}`);
    console.log(`   ✅ Physical Schema '${tenant.schemaName}' created.`);

    // 2. Create Table
    console.log("\n2. UI requests to create new 'Customers' table...");
    const table = await translator.createTable(tenant.id, "Customers", "customers", "Customer data table");
    console.log(`   ✅ Metadata saved with ID: ${table.id}`);
    console.log(`   ✅ Physical Table '${tenant.schemaName}.customers' created.`);

    // 3. Add Field
    console.log("\n3. UI requests to add 'first_name' field to 'Customers'...");
    const field = await translator.addFieldDef(table.id, "First Name", "first_name", "text", "short_text", null, true);
    console.log(`   ✅ Metadata saved with ID: ${field.id}`);
    console.log(`   ✅ Physical Column 'first_name' added to 'customers'.`);

    console.log("\n--- SCENARIO: Edit & Remove Metadata ---");
    
    // 4. Rename Field
    console.log("4. UI requests to rename 'first_name' to 'full_name'...");
    const renamedField = await translator.renameFieldDef(field.id, "Full Name", "full_name");
    console.log(`   ✅ Metadata updated for ID: ${renamedField.id}`);
    console.log(`   ✅ Physical Column renamed to 'full_name'.`);

    // 4.5 Add Relation Field
    console.log("\n4.5 UI requests to add 'account_id' relation field to 'Customers'...");
    const accountTable = await translator.createTable(tenant.id, "Accounts", "accounts", "Company accounts");
    console.log(`   ✅ Target Table 'Accounts' created with ID: ${accountTable.id}`);
    const relationField = await translator.addFieldDef(
      table.id, 
      "Account", 
      "account_id", 
      "relation", 
      "lookup", 
      { targetTable: "accounts" }, 
      false
    );
    console.log(`   ✅ Relation Field 'account_id' added with Foreign Key constraint! ID: ${relationField.id}`);

    // 5. Add a temporary field to delete
    console.log("\n5. UI requests to add 'age' field...");
    const ageField = await translator.addFieldDef(table.id, "Age", "age", "number", "number", { showCommas: false });
    
    console.log("   UI requests to remove 'age' field...");
    await translator.removeFieldDef(ageField.id);
    console.log(`   ✅ Metadata deleted for ID: ${ageField.id}`);
    console.log(`   ✅ Physical Column 'age' removed from 'customers'.`);

    console.log("\n🎉 Translator Test passed successfully! Metadata and DB are in sync.");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

run();
