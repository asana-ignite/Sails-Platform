import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SYSTEM_PERMISSION_REGISTRY } from '@/lib/security/registry';

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

      apps.sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    }

    // 2. Fallback Mock Data if DB is empty or no tenantId (e.g., local development without seeded data)
    if (apps.length === 0) {
      apps = getMockData();
    }

    // 3. Filter Apps and Menus by Role & System Capability
    const user = session?.user as any;
    const isSuperAdmin = user?.role === 'SUPER_ADMIN'; 
    const isTenantAdmin = user?.role === 'TENANT_ADMIN';
    const isSystemAdmin = isSuperAdmin || isTenantAdmin; // Both Super Admin & Tenant Admin see Admin & Settings menu

    let userCapabilities: string[] = [];

    if (isSystemAdmin) {
      // Super Admin & Tenant Admin get full access to Admin & Settings apps and menus
      userCapabilities = Object.keys(SYSTEM_PERMISSION_REGISTRY);
    } else {
      // Regular End-Users get ONLY business capabilities explicitly assigned to their active teams
      const userTeamMemberships = user?.id ? await db.userTeam.findMany({
        where: { userId: user.id },
        select: { teamId: true }
      }) : [];
      const teamIds = userTeamMemberships.map(t => t.teamId);

      const assignedPerms = teamIds.length > 0 ? await db.systemPermission.findMany({
        where: { teamId: { in: teamIds } },
        select: { capability: true }
      }) : [];
      userCapabilities = assignedPerms.map(p => p.capability);
    }

    console.log(`[CONFIG] User: ${user?.email || 'Anonymous'}, Role: ${user?.role || 'NONE'}, IsAdmin: ${isSystemAdmin}, Capabilities: ${userCapabilities.length}`);

    const filteredApps = apps.filter(app => {
      // If app has a required capability, user must possess it (unless isSystemAdmin)
      if (app.requiredCapability && !userCapabilities.includes(app.requiredCapability) && !isSystemAdmin) {
        return false;
      }
      return true;
    }).map(app => {
      // Filter child menus based on capabilities
      const filterMenus = (menuList: any[]) => {
        return menuList.filter(menu => {
          if (menu.requiredCapability && !userCapabilities.includes(menu.requiredCapability) && !isSystemAdmin) {
            return false;
          }
          return true;
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
      // Only return apps that contain visible menus or are marked public
      return (app.menus && app.menus.length > 0) || !app.requiredCapability;
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
      isSystem: true,
      menus: [
        {
          id: 'mock-menu-general',
          label: 'General',
          icon: 'Sliders',
          order: 0,
          children: [
            { id: 'm-prof', label: 'Company Profile', icon: 'Building', path: '/admin/profile', order: 0, requiredCapability: 'system.settings.profile', actionType: 'plugin', componentKey: 'AdminCompanyProfile' },
            { id: 'm-gen', label: 'General Settings', icon: 'Settings', path: '/admin/general', order: 1, requiredCapability: 'system.settings.edit', actionType: 'plugin', componentKey: 'AdminGeneralSettings' },
            { id: 'm-bill', label: 'Subscription & Billing', icon: 'CreditCard', path: '/admin/billing', order: 2, requiredCapability: 'system.billing.manage', actionType: 'plugin', componentKey: 'AdminBilling' }
          ]
        },
        {
          id: 'mock-menu-users',
          label: 'Users & Team',
          icon: 'Users',
          order: 1,
          children: [
            { id: 'm-users', label: 'Users', icon: 'UserPlus', path: '/admin/users', order: 0, requiredCapability: 'system.users.manage', actionType: 'plugin', componentKey: 'AdminUserManager' },
            { id: 'm-teams', label: 'Teams', icon: 'GitBranch', path: '/admin/teams', order: 1, requiredCapability: 'system.teams.manage', actionType: 'plugin', componentKey: 'AdminTeamManager' },
            { id: 'm-roles', label: 'Access Roles', icon: 'ShieldCheck', path: '/admin/roles', order: 2, requiredCapability: 'system.roles.assign', actionType: 'plugin', componentKey: 'AdminPermissions' }
          ]
        },
        {
          id: 'mock-menu-platform',
          label: 'Platform Studio',
          icon: 'Layout',
          order: 2,
          children: [
            { id: 'm-schema', label: 'Data Model', icon: 'Database', path: '/admin/schema', order: 0, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminEntityManager' },
            { id: 'm-views', label: 'Layouts', icon: 'LayoutTemplate', path: '/admin/views', order: 1, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminViewManager' },
            { id: 'm-workflow', label: 'Workflow', icon: 'Workflow', path: '/admin/workflow', order: 2, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminWorkflowManager' },
            { id: 'm-apps', label: 'Apps', icon: 'LayoutGrid', path: '/admin/apps', order: 3, requiredCapability: 'system.apps.manage', actionType: 'plugin', componentKey: 'AdminAppManager' }
          ]
        }
      ]
    }
  ];
}
