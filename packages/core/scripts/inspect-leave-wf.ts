import { Pool } from 'pg';

async function inspectLeaveWorkflow() {
  const tenantId = 'cmrxlaeys001iky2dlttomtrw';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    console.log('=== 1. WORKFLOW DEFINITIONS ===');
    const defs = await pool.query(
      `SELECT id, name, status, config, published_config, table_id 
       FROM core.workflow_definitions 
       WHERE tenant_id = $1 AND (name ILIKE '%leave%' OR id ILIKE '%leave%')`,
      [tenantId]
    );
    for (const d of defs.rows) {
      console.log(`Def ID: ${d.id}, Name: ${d.name}, Status: ${d.status}, Table ID: ${d.table_id}`);
      console.log('--- Config (Draft) ---');
      console.log(JSON.stringify(d.config, null, 2));
      console.log('--- Published Config ---');
      console.log(JSON.stringify(d.published_config, null, 2));
    }

    console.log('\n=== 2. WORKFLOW INSTANCES (RECENT) ===');
    const instances = await pool.query(
      `SELECT id, def_id, state, current_step_ids, vars, created_by, trigger, record_id, created_at 
       FROM tenant_${tenantId}.wf_instance 
       ORDER BY created_at DESC LIMIT 5`
    );
    console.log(JSON.stringify(instances.rows, null, 2));

    console.log('\n=== 3. WORKFLOW TASKS ===');
    const tasks = await pool.query(
      `SELECT id, instance_id, step_id, status, assignee_type, assignee_id, assignee_users, actions, created_at 
       FROM tenant_${tenantId}.wf_task 
       ORDER BY created_at DESC LIMIT 5`
    );
    console.log(JSON.stringify(tasks.rows, null, 2));

    console.log('\n=== 4. WORKFLOW ACTION LOG ===');
    const logs = await pool.query(
      `SELECT id, instance_id, step_id, action, actor_id, detail, created_at 
       FROM tenant_${tenantId}.wf_action_log 
       ORDER BY created_at DESC LIMIT 10`
    );
    console.log(JSON.stringify(logs.rows, null, 2));

    console.log('\n=== 5. WORKFLOW EXECUTION LOG ===');
    const execLogs = await pool.query(
      `SELECT id, instance_id, status, error, stage_id, event_type, events, created_at 
       FROM tenant_${tenantId}.wf_execution_log 
       ORDER BY created_at DESC LIMIT 5`
    );
    console.log(JSON.stringify(execLogs.rows, null, 2));

  } catch (err: any) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

inspectLeaveWorkflow();
