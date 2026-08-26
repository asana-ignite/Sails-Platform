import { Pool } from 'pg';

async function inspectRoleAndAssignee() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const s = 'tenant_sails_default';
    const users = await pool.query(`SELECT id, email, name, role FROM core.users WHERE tenant_id = 'cmrxlaeys001iky2dlttomtrw'`);
    console.log('Users:', users.rows);

    const tasks = await pool.query(`SELECT id, instance_id, assignee_type, assignee_id, assignee_users, status FROM ${s}.wf_task ORDER BY created_at DESC LIMIT 5`);
    console.log('\nRecent tasks:');
    console.log(JSON.stringify(tasks.rows, null, 2));

    const wf = await pool.query(`SELECT id, name, status, config, published_config FROM core.workflow_definitions WHERE name ILIKE '%leave%'`);
    console.log('\nLeave Request WF:');
    const dag = wf.rows[0]?.config || wf.rows[0]?.published_config;
    console.log('Events in DAG:', JSON.stringify(dag?.stages?.map((st: any) => ({ stage: st.name, events: st.events })), null, 2));
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectRoleAndAssignee();
