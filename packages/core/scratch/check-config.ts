import { Pool } from 'pg';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost:5432/postgres'
});

async function checkConfig() {
  const provisioner = new TenantProvisioner(pool);
  console.log("Provisioning fresh tenant...");
  const result = await provisioner.provisionTenant("Config Check 2", `check${Date.now()}@test.com`);
  
  const client = await pool.connect();
  try {
    const menus = await client.query('SELECT label, path, component_key FROM core.console_menus');
    console.log("\n--- CONSOLE MENUS ---");
    console.table(menus.rows.filter(m => m.component_key));
  } finally {
    client.release();
    await pool.end();
  }
}

checkConfig();
