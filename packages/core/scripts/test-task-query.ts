import { Pool } from 'pg';

async function testTaskQuery() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const s = 'tenant_sails_default';
    const userId = 'cmrxlaeyy001lky2d63a9qnch'; // admin user
    const tenantId = 'cmrxlaeys001iky2dlttomtrw';

    const params: any[] = [JSON.stringify([userId])];
    const where: string[] = [`t.assignee_users @> $1::jsonb`];
    where.push(`t.status = 'pending'`);

    const param = (v: any): string => {
      params.push(v);
      return `$${params.length}`;
    };

    const fromSql = `
      FROM ${s}.wf_task t
      JOIN ${s}.wf_instance i ON i.id = t.instance_id
      JOIN core.workflow_definitions d ON d.id = i.def_id AND d.tenant_id = ${param(tenantId)}`;

    const whereSql = where.join(' AND ');

    console.log('Query:', `SELECT t.id, t.status, d.name ${fromSql} WHERE ${whereSql}`);
    console.log('Params:', params);

    const res = await pool.query(
      `SELECT t.id, t.status, d.name ${fromSql} WHERE ${whereSql}`,
      params
    );

    console.log('Result rows:', res.rows);
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testTaskQuery();
