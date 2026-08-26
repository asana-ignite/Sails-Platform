import { Pool } from 'pg';

async function inspectSchemas() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const schemas = await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema')`
    );
    console.log('Schemas:', schemas.rows.map(r => r.schema_name));

    for (const row of schemas.rows) {
      const s = row.schema_name;
      const tables = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'wf_%'`,
        [s]
      );
      if (tables.rows.length > 0) {
        console.log(`Schema ${s} has wf tables:`, tables.rows.map(r => r.table_name));
        const instances = await pool.query(`SELECT * FROM "${s}".wf_instance ORDER BY created_at DESC LIMIT 5`);
        console.log(`Instances in ${s}:`, JSON.stringify(instances.rows, null, 2));

        const tasks = await pool.query(`SELECT * FROM "${s}".wf_task ORDER BY created_at DESC LIMIT 5`);
        console.log(`Tasks in ${s}:`, JSON.stringify(tasks.rows, null, 2));

        const logs = await pool.query(`SELECT * FROM "${s}".wf_execution_log ORDER BY created_at DESC LIMIT 5`);
        console.log(`Execution logs in ${s}:`, JSON.stringify(logs.rows, null, 2));
      }
    }
  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectSchemas();
