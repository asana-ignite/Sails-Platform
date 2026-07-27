import { Pool } from 'pg';
import { db } from '../src/lib/db';
import { AlchemaCore, parseAutoNumberPattern } from '../src/core/engine/AlchemaCore';
import { TranslatorLayer } from '../src/services/TranslatorLayer';
import { TenantProvisioner } from '../src/services/TenantProvisioner';
import { FieldRegistry } from '../src/core/registry/FieldRegistry';
import assert from 'assert';

async function run() {
  console.log("Connecting to PostgreSQL and Prisma...");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const alchemaCore = new AlchemaCore(pool);
  const translator = new TranslatorLayer(alchemaCore);

  try {
    console.log("--- CLEANUP ---");
    await pool.query('DROP SCHEMA IF EXISTS tenant_autonumber_test CASCADE');
    await db.tenant.deleteMany({ where: { schemaName: 'tenant_autonumber_test' } });

    console.log("\n--- SCENARIO 1: Pattern Parsing Unit Tests ---");

    // Test parseAutoNumberPattern
    const p1 = parseAutoNumberPattern("INV-0000");
    assert.strictEqual(p1.prefix, "INV-");
    assert.strictEqual(p1.digits, 4);
    assert.strictEqual(p1.suffix, "");
    console.log("   ✅ 'INV-0000' parsed -> prefix: 'INV-', digits: 4");

    const p2 = parseAutoNumberPattern("INV-{yyyy}00000");
    assert.strictEqual(p2.prefix, "INV-{YYYY}");
    assert.strictEqual(p2.digits, 5);
    assert.strictEqual(p2.suffix, "");
    console.log("   ✅ 'INV-{yyyy}00000' parsed -> prefix: 'INV-{YYYY}', digits: 5");

    const p3 = parseAutoNumberPattern("REQ-{yyyy}-{mm}-000-US");
    assert.strictEqual(p3.prefix, "REQ-{YYYY}-{MM}-");
    assert.strictEqual(p3.digits, 3);
    assert.strictEqual(p3.suffix, "-US");
    console.log("   ✅ 'REQ-{yyyy}-{mm}-000-US' parsed -> prefix: 'REQ-{YYYY}-{MM}-', digits: 3, suffix: '-US'");

    console.log("\n--- SCENARIO 2: Integration DB Auto Number Generation ---");

    // Create Tenant & Table
    const provisioner = new TenantProvisioner(pool);
    const provisionResult = await provisioner.provisionTenant("AutoNumber Tenant", "admin@autonumber.com");
    const tenant = provisionResult.tenant;
    await pool.query(`ALTER SCHEMA "${tenant.schemaName}" RENAME TO tenant_autonumber_test`);
    await db.tenant.update({ where: { id: tenant.id }, data: { schemaName: 'tenant_autonumber_test' } });
    const schemaName = 'tenant_autonumber_test';

    const table = await translator.createTable(tenant.id, "Purchase Orders", "purchase_orders", "PO table");
    console.log(`   ✅ Table created: ${schemaName}.purchase_orders`);

    // Add field with pattern: INV-{yyyy}0000
    console.log("\n3. Adding Auto Number field 'po_number' with pattern 'PO-{yyyy}{mm}0000'...");
    const autoNumField = await translator.addFieldDef(
      table.id,
      "PO Number",
      "po_number",
      "text",
      "auto_number",
      {
        prefix: "PO-{yyyy}{mm}0000",
        startingNumber: 1
      },
      false
    );
    console.log(`   ✅ Auto Number Field added with ID: ${autoNumField.id}`);

    // Insert records and verify sequence generation
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const expectedPrefix = `PO-${currentYear}${currentMonth}`;

    console.log("\n4. Inserting test records...");
    const res1 = await pool.query(
      `INSERT INTO "${schemaName}"."purchase_orders" (id, tenant_id, owner_id) VALUES ('rec_1', '${tenant.id}', 'user_1') RETURNING po_number`
    );
    const val1 = res1.rows[0].po_number;
    console.log(`   Record 1 generated po_number: ${val1}`);
    assert.strictEqual(val1, `${expectedPrefix}0001`);

    const res2 = await pool.query(
      `INSERT INTO "${schemaName}"."purchase_orders" (id, tenant_id, owner_id) VALUES ('rec_2', '${tenant.id}', 'user_1') RETURNING po_number`
    );
    const val2 = res2.rows[0].po_number;
    console.log(`   Record 2 generated po_number: ${val2}`);
    assert.strictEqual(val2, `${expectedPrefix}0002`);

    // Test Admin Sequence Reset
    console.log("\n5. Testing Admin Sequence Reset to 500...");
    await translator.resetFieldSequence(autoNumField.id, 500);

    const res3 = await pool.query(
      `INSERT INTO "${schemaName}"."purchase_orders" (id, tenant_id, owner_id) VALUES ('rec_3', '${tenant.id}', 'user_1') RETURNING po_number`
    );
    const val3 = res3.rows[0].po_number;
    console.log(`   Record 3 generated po_number after reset: ${val3}`);
    assert.strictEqual(val3, `${expectedPrefix}0500`);

    console.log("\n🎉 ALL PATTERN AUTO NUMBER TESTS PASSED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await pool.query('DROP SCHEMA IF EXISTS tenant_autonumber_test CASCADE');
    await db.tenant.deleteMany({ where: { schemaName: 'tenant_autonumber_test' } });
    await pool.end();
    await db.$disconnect();
  }
}

run();
