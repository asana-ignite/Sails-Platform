import { Pool } from 'pg';
import { db } from '../src/lib/db';

async function cleanDatabase() {
  console.log("Connecting to PostgreSQL and Prisma to clean all tenants and entities...");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@host.docker.internal:5432/postgres'
  });

  try {
    // 1. Scan PostgreSQL directly for ALL physical tenant schemas
    //    This catches orphaned schemas that may not have matching metadata.
    const physicalSchemas = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name"
    );

    if (physicalSchemas.rows.length === 0) {
      console.log("No physical tenant schemas found in PostgreSQL.");
    } else {
      console.log(`Found ${physicalSchemas.rows.length} physical schema(s). Dropping...`);
      for (const row of physicalSchemas.rows) {
        console.log(`  Dropping physical schema: ${row.schema_name}`);
        await pool.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
      }
    }

    // 2. Delete all metadata (cascade deletes EntityDefinitions, Columns, Rules)
    console.log("Deleting all metadata from Prisma...");
    await db.auditLog.deleteMany({});
    await db.objectPermission.deleteMany({});
    await db.user.deleteMany({});
    await db.team.deleteMany({});
    const result = await db.tenant.deleteMany({});
    console.log(`Deleted ${result.count} tenant records from metadata.`);

    // 3. Verify consistency
    const remaining = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'"
    );
    const remainingTenants = await db.tenant.findMany();

    if (remaining.rows.length === 0 && remainingTenants.length === 0) {
      console.log("\n✅ All physical schemas and metadata have been successfully cleaned!");
    } else {
      console.error("\n⚠️ Warning: Cleanup may be incomplete.");
      console.error(`   Physical schemas remaining: ${remaining.rows.length}`);
      console.error(`   Metadata tenants remaining: ${remainingTenants.length}`);
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

cleanDatabase();
