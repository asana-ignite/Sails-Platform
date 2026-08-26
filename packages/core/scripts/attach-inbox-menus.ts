import { Pool } from 'pg';

async function main() {
  const tenantId = 'cmrxlaeys001iky2dlttomtrw';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@localhost:5433/postgres?schema=core'
  });

  try {
    console.log(`🔍 Finding app for tenant: ${tenantId}...`);

    // 1. Find app
    const appRes = await pool.query(
      `SELECT id, name FROM core.console_apps 
       WHERE tenant_id = $1 AND (name ILIKE '%inbox%' OR name ILIKE '%approval%' OR id ILIKE '%inbox%')`,
      [tenantId]
    );

    let appId: string;
    if (appRes.rows.length === 0) {
      console.log('App not found with name filter, checking all apps for tenant...');
      const allApps = await pool.query(`SELECT id, name FROM core.console_apps WHERE tenant_id = $1`, [tenantId]);
      console.log('Available apps:', allApps.rows);
      
      // Create if needed
      const ins = await pool.query(
        `INSERT INTO core.console_apps (id, tenant_id, name, icon, "order", is_system)
         VALUES ('app_inbox_' || substr(md5(random()::text), 1, 8), $1, 'Approvals & Tasks', 'CheckSquare', 3, false)
         RETURNING id, name`,
        [tenantId]
      );
      appId = ins.rows[0].id;
      console.log(`Created app: ${ins.rows[0].name} (${appId})`);
    } else {
      appId = appRes.rows[0].id;
      console.log(`Found app: ${appRes.rows[0].name} (${appId})`);
    }

    // 2. Check existing menus
    const menus = await pool.query(`SELECT id, label, component_key, path FROM core.console_menus WHERE app_id = $1`, [appId]);
    console.log('Existing menus in app:', menus.rows);

    const hasApprovals = menus.rows.some((m: any) => m.component_key === 'TaskInbox' || m.path === '/inbox/approvals');
    const hasHistory = menus.rows.some((m: any) => m.component_key === 'TaskInboxHistory' || m.path === '/inbox/history');

    if (!hasApprovals) {
      const m1Id = 'menu_' + Math.random().toString(36).substring(2, 11);
      await pool.query(
        `INSERT INTO core.console_menus (id, tenant_id, app_id, label, icon, path, component_key, action_type, "order", is_system)
         VALUES ($1, $2, $3, 'My Approvals', 'Clock', '/inbox/approvals', 'TaskInbox', 'plugin', 0, false)`,
        [m1Id, tenantId, appId]
      );
      console.log('✅ Added "My Approvals" menu item');
    } else {
      console.log('ℹ️ "My Approvals" menu item already exists');
    }

    if (!hasHistory) {
      const m2Id = 'menu_' + Math.random().toString(36).substring(2, 11);
      await pool.query(
        `INSERT INTO core.console_menus (id, tenant_id, app_id, label, icon, path, component_key, action_type, "order", is_system)
         VALUES ($1, $2, $3, 'History', 'CheckCircle', '/inbox/history', 'TaskInboxHistory', 'plugin', 1, false)`,
        [m2Id, tenantId, appId]
      );
      console.log('✅ Added "History" menu item');
    } else {
      console.log('ℹ️ "History" menu item already exists');
    }

    console.log('🎉 Done registering navigation menus!');
  } catch (err: any) {
    console.error('Error attaching menus:', err);
  } finally {
    await pool.end();
  }
}

main();
