import { db } from '../src/lib/db';
import { TenantProvisioner } from '../src/services/TenantProvisioner';

async function seedModels() {
  const tenant = await db.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found.");
    return;
  }
  console.log(`Provisioning standard data models for tenant ${tenant.name} (${tenant.id})...`);
  const provisioner = new TenantProvisioner();
  await provisioner.provisionStandardDataModels(tenant.id);
  console.log("Done!");
}

seedModels().catch(console.error).finally(() => process.exit(0));
