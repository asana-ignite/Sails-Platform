import { Pool } from 'pg';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  const provisioner = new TenantProvisioner(pool);
  
  console.log('🌱 Seeding default tenant...');
  try {
    const result = await provisioner.provisionTenant('KLAO Default', 'admin@klao.app');
    console.log('✅ Default tenant provisioned:', result.tenant.id);
  } catch (e: any) {
    if (e.message.includes('unique constraint')) {
      console.log('ℹ️ Default tenant already exists.');
    } else {
      console.error('❌ Seeding failed:', e.message);
    }
  } finally {
    await pool.end();
  }
}

seed();
