import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * GET /api/console/config
 * Fetches the UI metadata (Apps and Menus) for the authenticated tenant.
 * Returns mock data if the database is empty.
 */
export async function GET() {
  try {
    const session = await getAppSession();
    // Use session tenantId, or fallback to DEFAULT_TENANT_ID env var for testing/dev
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    let apps: any[] = [];

    // 1. Try to fetch from Database if tenantId is present
    if (tenantId) {
      apps = await db.consoleApp.findMany({
        where: { tenantId },
        orderBy: { order: 'asc' },
        include: {
          menus: {
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: {
              children: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      });
    }

    // 2. Fallback Mock Data if DB is empty or no tenantId (e.g., local development without seeded data)
    if (apps.length === 0) {
      apps = getMockData();
    }

    // 3. Filter by Required Capability
    const user = session?.user as any;
    // TEMPORARY: Force Admin mode to true for structure verification
    const isSystemAdmin = true; // user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';

    console.log(`[CONFIG] User: ${user?.email || 'Anonymous'}, Tenant: ${tenantId}, Admin: ${isSystemAdmin}, AppCount: ${apps.length}`);

    let userCapabilities: string[] = [];
    if (!isSystemAdmin && user?.teamId) {
      const perms = await db.systemPermission.findMany({
        where: { teamId: user.teamId },
        select: { capability: true }
      });
      userCapabilities = perms.map(p => p.capability);
    }

    const filteredApps = apps.filter(app => {
      if (!app.requiredCapability || isSystemAdmin) return true;
      return userCapabilities.includes(app.requiredCapability);
    }).map(app => {
      // Create a recursive filter for menus
      const filterMenus = (menuList: any[]) => {
        return menuList.filter(menu => {
          if (!menu.requiredCapability || isSystemAdmin) return true;
          return userCapabilities.includes(menu.requiredCapability);
        }).map(menu => ({
          ...menu,
          children: menu.children ? filterMenus(menu.children) : []
        }));
      };

      return {
        ...app,
        menus: filterMenus(app.menus || [])
      };
    }).filter(app => {
      // Only show apps that have at least one visible menu OR are explicitly marked as public
      const hasVisibleMenus = app.menus.length > 0;
      return hasVisibleMenus || !app.requiredCapability;
    });

    console.log(`[CONFIG] Returning ${filteredApps.length} apps`);

    return NextResponse.json({
      success: true,
      _debug: { version: '6.5.0', timestamp: new Date().toISOString(), tenantId },
      data: { apps: filteredApps }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });


  } catch (error: any) {
    console.error('[API CONSOLE CONFIG ERROR]:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}


function getMockData() {
  return [
    {
      id: 'mock-app-dashboard',
      name: 'Dashboard',
      icon: 'LayoutDashboard',
      order: 0,
      menus: [
        {
          id: 'mock-menu-overview',
          label: 'Overview',
          icon: 'Activity',
          path: '/',
          actionType: 'plugin',
          order: 0,
          children: []
        }
      ]
    },
    {
      id: 'mock-app-crm',
      name: 'CRM',
      icon: 'Users',
      order: 1,
      menus: [
        {
          id: 'mock-menu-leads',
          label: 'Leads',
          icon: 'Target',
          path: '/table/leads',
          actionType: 'table',
          order: 0,
          children: []
        },
        {
          id: 'mock-menu-customers',
          label: 'Customers',
          icon: 'UserCheck',
          path: '/table/customers',
          actionType: 'table',
          order: 1,
          children: []
        }
      ]
    },
    {
      id: 'mock-app-admin',
      name: 'Settings & Admin',
      icon: 'Settings',
      order: 99,
      menus: [
        {
          id: 'mock-menu-general',
          label: 'General',
          icon: 'Sliders',
          order: 0,
          children: [
            { id: 'm-prof', label: 'Company Profile', icon: 'Building', path: '/settings/profile', order: 0, requiredCapability: 'system.settings.profile' },
            { id: 'm-gen', label: 'General Settings', icon: 'Settings', path: '/settings/general', order: 1, requiredCapability: 'system.settings.edit' },
            { id: 'm-bill', label: 'Subscription & Billing', icon: 'CreditCard', path: '/settings/billing', order: 2, requiredCapability: 'system.billing.manage' }
          ]
        },
        {
          id: 'mock-menu-users',
          label: 'Users & Team',
          icon: 'Users',
          order: 1,
          children: [
            { id: 'm-users', label: 'Users', icon: 'UserPlus', path: '/settings/users', order: 0, requiredCapability: 'system.users.manage' },
            { id: 'm-teams', label: 'Teams', icon: 'GitBranch', path: '/settings/teams', order: 1, requiredCapability: 'system.teams.manage' },
            { id: 'm-roles', label: 'Access Roles', icon: 'ShieldCheck', path: '/settings/roles', order: 2, requiredCapability: 'system.roles.assign' }
          ]
        },
        {
          id: 'mock-menu-platform',
          label: 'Platform Studio',
          icon: 'Layout',
          order: 2,
          children: [
            { id: 'm-schema', label: 'Data Entities', icon: 'Database', path: '/settings/schema', order: 0, requiredCapability: 'system.schema.manage' },
            { id: 'm-apps', label: 'Console Apps', icon: 'LayoutGrid', path: '/settings/apps', order: 1, requiredCapability: 'system.apps.manage' },
            { id: 'm-menus', label: 'Navigation Menus', icon: 'Menu', path: '/settings/menus', order: 2, requiredCapability: 'system.menus.manage' }
          ]
        }
      ]
    }
  ];
}
