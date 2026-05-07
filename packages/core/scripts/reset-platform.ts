import { Pool } from 'pg';
import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function resetPlatform() {
  const args = process.argv.slice(2);
  const phase = args.includes('--phase') ? args[args.indexOf('--phase') + 1] : 'all';
  
  console.log(`🚀 Starting Platform Reset (Phase: ${phase})...`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  const API_URL = 'http://localhost:3000';

  try {
    if (phase === 'all' || phase === '1') {
      // 1. Clean Database (Physical Schemas)
      console.log("🧹 [PHASE 1] Dropping all physical tenant schemas...");
      const physicalSchemas = await pool.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name"
      );

      for (const row of physicalSchemas.rows) {
        console.log(`   - Dropping schema: ${row.schema_name}`);
        await pool.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
      }

      // 2. Clean Metadata (Prisma)
      console.log("🗑️  [PHASE 1] Deleting all metadata from core schema...");
      await db.auditLog.deleteMany({});
      await db.objectPermission.deleteMany({});
      await db.user.deleteMany({});
      await db.team.deleteMany({});
      await db.consoleMenu.deleteMany({});
      await db.consoleApp.deleteMany({});
      const tenantResult = await db.tenant.deleteMany({});
      console.log(`   - Deleted ${tenantResult.count} tenant records.`);

      // 3. Provision Default Test Tenant via API
      console.log("🌱 [PHASE 1] Provisioning 'KLAO Default' tenant via API...");
      const provisionResponse = await fetch(`${API_URL}/api/tenant/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'KLAO Default',
          adminEmail: 'admin@klao.app'
        })
      });

      if (!provisionResponse.ok) {
        throw new Error(`Provisioning failed: ${await provisionResponse.text()}`);
      }

      const result = await provisionResponse.json();
      const tenantId = result.tenant.id;
      console.log(`   - Created Tenant ID: ${tenantId}`);

      // 4. Update .env file
      console.log("📝 [PHASE 1] Updating .env file with new DEFAULT_TENANT_ID...");
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        const regex = /^DEFAULT_TENANT_ID=.*$/m;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `DEFAULT_TENANT_ID="${tenantId}"`);
        } else {
          envContent += `\nDEFAULT_TENANT_ID="${tenantId}"`;
        }
        fs.writeFileSync(envPath, envContent);
        console.log(`   - Updated DEFAULT_TENANT_ID to ${tenantId}`);
      }

      console.log("\n✅ Phase 1 Complete. RESTART the 'klao-core' service before running Phase 2.");
    }

    if (phase === 'all' || phase === '2') {
      console.log("🍱 [PHASE 2] Seeding Standard Apps and Menus via API...");
      
      // Cleanup auto-provisioned apps first to avoid unique constraint errors
      console.log("   - Cleaning up auto-provisioned apps...");
      const listResponse = await fetch(`${API_URL}/api/console/apps`);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const existingApps = listData.data || [];
        for (const app of existingApps) {
          if (['CRM', 'Sales', 'Dashboard'].includes(app.name)) {
            console.log(`     - Deleting default app: ${app.name}`);
            await fetch(`${API_URL}/api/console/apps?id=${app.id}`, { method: 'DELETE' });
          }
        }
      }

      const standardApps = [
        {
          name: "Sales",
          icon: "ShoppingBag",
          order: 0,
          menus: [
            { label: "Leads", icon: "Users", path: "/table/leads", actionType: "table", order: 0 },
            { label: "Accounts", icon: "Building", path: "/table/accounts", actionType: "table", order: 1 },
            { label: "Contacts", icon: "UserSquare", path: "/table/contacts", actionType: "table", order: 2 },
            { label: "Opportunities", icon: "Target", path: "/table/opportunities", actionType: "table", order: 3 },
            { label: "Quotes", icon: "FileText", path: "/table/quotes", actionType: "table", order: 4 },
          ]
        },
        {
          name: "Sales Manager",
          icon: "Briefcase",
          order: 1,
          menus: [
            { label: "Team Performance", icon: "BarChart3", path: "/dashboard/performance", actionType: "plugin", order: 0 },
            { label: "Sales Forecast", icon: "LineChart", path: "/dashboard/forecast", actionType: "plugin", order: 1 },
            { label: "Territory Management", icon: "Map", path: "/table/territories", actionType: "table", order: 2 },
            { label: "Commission Reports", icon: "BadgeDollarSign", path: "/table/commissions", actionType: "table", order: 3 },
            { label: "Approval Requests", icon: "ClipboardCheck", path: "/approvals", actionType: "plugin", order: 4 },
          ]
        },
        {
          name: "Marketing",
          icon: "Megaphone",
          order: 2,
          menus: [
            { label: "Campaigns", icon: "Flag", path: "/table/campaigns", actionType: "table", order: 0 },
            { label: "Email Templates", icon: "Mail", path: "/table/templates", actionType: "table", order: 1 },
            { label: "Content Library", icon: "Library", path: "/library", actionType: "plugin", order: 2 },
            { label: "Social Analytics", icon: "Share2", path: "/dashboard/social", actionType: "plugin", order: 3 },
            { label: "Customer Segments", icon: "Users2", path: "/table/segments", actionType: "table", order: 4 },
          ]
        },
        {
          name: "Services",
          icon: "LifeBuoy",
          order: 3,
          menus: [
            { label: "Support Cases", icon: "Inbox", path: "/table/cases", actionType: "table", order: 0 },
            { label: "Knowledge Base", icon: "BookOpen", path: "/kb", actionType: "plugin", order: 1 },
            { label: "SLA Management", icon: "ShieldCheck", path: "/table/sla", actionType: "table", order: 2 },
            { label: "Customer Feedback", icon: "MessageSquare", path: "/table/feedback", actionType: "table", order: 3 },
            { label: "Resource Scheduling", icon: "Calendar", path: "/calendar/resources", actionType: "plugin", order: 4 },
          ]
        }
      ];

      for (const appDef of standardApps) {
        console.log(`   - Creating App: ${appDef.name}`);
        const appResponse = await fetch(`${API_URL}/api/console/apps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: appDef.name,
            icon: appDef.icon,
            order: appDef.order
          })
        });

        if (!appResponse.ok) {
          console.error(`     ⚠️ Failed to create app ${appDef.name}: ${await appResponse.text()}`);
          continue;
        }

        const appData = await appResponse.json();
        const appId = appData.data.id;

        for (const menuDef of appDef.menus) {
          const menuResponse = await fetch(`${API_URL}/api/console/menus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId,
              label: menuDef.label,
              icon: menuDef.icon,
              path: menuDef.path,
              actionType: menuDef.actionType,
              order: menuDef.order
            })
          });

          if (!menuResponse.ok) {
            console.error(`     ⚠️ Failed to create menu ${menuDef.label}: ${await menuResponse.text()}`);
          }
        }
      }

      console.log("\n✅ Phase 2 Complete. All standard apps and menus seeded via API.");
    }

  } catch (error) {
    console.error("\n❌ Reset Failed:", error);
  } finally {
    await pool.end();
    await db.$disconnect();
  }
}

resetPlatform();
