import { ConnectionManager } from '../src/core/engine/ConnectionManager';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

async function main() {
  const tenantId = process.env.DEFAULT_TENANT_ID || "ffecbf6e-2574-4636-bc99-d228c9f869a7";
  console.log(`🚀 Provisioning Settings & Admin for Tenant: ${tenantId}`);

  // Initialize DB Connection
  ConnectionManager.initialize();
  const provisioner = new TenantProvisioner();

  
  try {
    await provisioner.provisionSystemApps(tenantId);
    console.log('✅ Settings & Admin App provisioned successfully.');
  } catch (error: any) {
    console.error('❌ Provisioning failed:', error.message);
  } finally {
    process.exit();
  }
}

main();
