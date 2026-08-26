import { Pool } from 'pg';

async function inspectUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const res = await pool.query(
      `SELECT id, email, name, role, is_active, tenant_id FROM core.users`
    );
    console.log('Users in core.users:', res.rows);
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectUsers();
