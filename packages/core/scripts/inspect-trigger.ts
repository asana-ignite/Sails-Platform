import { Pool } from 'pg';

async function inspectLeaveWorkflowTrigger() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const res = await pool.query(
      `SELECT id, name, status, config, published_config 
       FROM core.workflow_definitions 
       WHERE name ILIKE '%leave%'`
    );
    for (const r of res.rows) {
      console.log('=== Workflow:', r.name, '===');
      console.log('status:', r.status);
      console.log('config triggerCondition:', JSON.stringify(r.config?.triggerCondition, null, 2));
      console.log('published_config triggerCondition:', JSON.stringify(r.published_config?.triggerCondition, null, 2));
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectLeaveWorkflowTrigger();
