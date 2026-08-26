import { Pool } from 'pg';

async function inspectLeaveWorkflowApproval() {
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
      const dag = r.config || r.published_config;
      for (const st of (dag?.stages || [])) {
        console.log(`\nStage: ${st.name} (${st.id})`);
        console.log('Events:', JSON.stringify(st.events, null, 2));
      }
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectLeaveWorkflowApproval();
