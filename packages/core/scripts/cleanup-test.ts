import { Pool } from 'pg';

async function cleanupTest() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const s = 'tenant_sails_default';
    await pool.query(`DELETE FROM ${s}.wf_task WHERE instance_id = 'wf_mtabf3arzvg2nc'`);
    await pool.query(`DELETE FROM ${s}.wf_instance WHERE id = 'wf_mtabf3arzvg2nc'`);
    console.log('Cleaned up mock instance');
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

cleanupTest();
