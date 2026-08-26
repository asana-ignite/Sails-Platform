import { Pool } from 'pg';

async function inspectActiveDefs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const res = await pool.query(
      `SELECT id, name, status, table_id, config, published_config 
       FROM core.workflow_definitions 
       WHERE tenant_id = 'cmrxlaeys001iky2dlttomtrw'`
    );
    console.log('All workflow definitions for tenant:');
    for (const r of res.rows) {
      console.log(`- ID: ${r.id}, Name: ${r.name}, Status: ${r.status}, Table ID: ${r.table_id}`);
      console.log('  triggerOn:', (r.config || r.published_config)?.triggerOn);
      console.log('  triggerCondition:', JSON.stringify((r.config || r.published_config)?.triggerCondition));
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectActiveDefs();
