import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost:5432/postgres'
});

async function addTestPlugin() {
  const client = await pool.connect();
  try {
    // Find a tenant
    const tenantRes = await client.query('SELECT id FROM core.tenants LIMIT 1');
    if (tenantRes.rows.length === 0) {
      console.log("No tenant found. Run tests first.");
      return;
    }
    const tenantId = tenantRes.rows[0].id;

    // Find the 'Settings & Admin' app
    const appRes = await client.query('SELECT id FROM core.console_apps WHERE tenant_id = $1 AND name = $2', [tenantId, 'Settings & Admin']);
    if (appRes.rows.length === 0) {
      console.log("Settings & Admin app not found.");
      return;
    }
    const appId = appRes.rows[0].id;

    // Add a test menu item
    await client.query(`
      INSERT INTO core.console_menus (id, app_id, label, path, component_key, action_type, "order")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
    `, [appId, 'Test Plugin', '/settings/test', 'TestPlugin', 'plugin', 100]);

    console.log("✅ Test Plugin menu item added to DB at /settings/test");
  } finally {
    client.release();
    await pool.end();
  }
}

addTestPlugin();
