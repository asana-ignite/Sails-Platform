import { ConnectionManager } from '../src/core/engine/ConnectionManager';
import { db } from '../src/lib/db';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID || "ffecbf6e-2574-4636-bc99-d228c9f869a7";
  console.log(`♻️ Re-provisioning Settings & Admin for Tenant: ${tenantId}`);

  ConnectionManager.initialize();
  const provisioner = new TenantProvisioner();
  
  try {
    // 1. Delete old one
    await db.consoleApp.deleteMany({
      where: {
        tenantId,
        name: 'Settings & Admin'
      }
    });
    console.log('🗑️ Deleted old Settings & Admin app.');

    // 2. Provision new one
    await provisioner.provisionSystemApps(tenantId);
    console.log('✅ Re-provisioned successfully with new structure.');
  } catch (error: any) {
    console.error('❌ Re-provisioning failed:', error.message);
  } finally {
    process.exit();
  }
}

main();
