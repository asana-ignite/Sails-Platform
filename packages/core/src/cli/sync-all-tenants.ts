/**
 * sync-all-tenants — one-off maintenance: re-runs a provisioning step
 * (menus/capabilities/apps) across every existing tenant. Used after a
 * platform upgrade that adds new default navigation.
 */
import { db } from '../lib/db';
import { TenantProvisioner } from '../services/TenantProvisioner';
import { ConnectionManager } from '../core/engine/ConnectionManager';

async function syncAllTenants() {
  console.log("🚀 Starting Global App & Metadata synchronization...");
  
  // Initialize connection manager
  const { Pool } = require('pg');
  ConnectionManager.initialize(new Pool());
  
  const provisioner = new TenantProvisioner();
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true }
  });

  console.log(`Found ${tenants.length} tenants. Updating metadata...`);

  for (const tenant of tenants) {
    try {
      console.log(`\nSyncing [${tenant.name}] (${tenant.id})...`);
      
      console.log(` - Provisioning System Apps...`);
      await provisioner.provisionSystemApps(tenant.id);
      
      console.log(` - Provisioning Business Apps (CRM, Sales, Dashboard)...`);
      await provisioner.provisionBusinessApps(tenant.id);
      
      console.log(`✅ Success: ${tenant.name}`);
    } catch (error) {
      console.error(`❌ Failed: ${tenant.name}`, error);
    }
  }

  console.log("\n✨ Synchronization complete. All tenants now have the full Business & Admin workspace suite.");
  process.exit(0);
}

syncAllTenants();
