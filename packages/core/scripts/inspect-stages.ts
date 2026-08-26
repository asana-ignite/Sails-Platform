import { Pool } from 'pg';

async function inspectLeaveWorkflowStages() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const res = await pool.query(
      `SELECT id, name, status, published_config 
       FROM core.workflow_definitions 
       WHERE name ILIKE '%leave%'`
    );
    for (const row of res.rows) {
      console.log('=== WORKFLOW:', row.name, '===');
      console.log('STAGES in published_config:');
      for (const st of (row.published_config?.stages || [])) {
        console.log(`\nStage ID: ${st.id}, Name: ${st.name}`);
        console.log('Events:', JSON.stringify(st.events, null, 2));
        console.log('Branches:', JSON.stringify(st.branches, null, 2));
      }
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectLeaveWorkflowStages();
