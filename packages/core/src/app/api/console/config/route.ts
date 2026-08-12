/**
 * Console bootstrap config: the tenant's apps + sidebar menus that drive the
 * ConsoleContext/Sidebar. DB-driven navigation — empty DB falls back to mock
 * data so the UI never renders blank.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';
import { SYSTEM_PERMISSION_REGISTRY } from '@/lib/security/registry';
import { getConfigCache, setConfigCache } from '@/lib/configCache';

/**
 * GET /api/console/config
 * Fetches the UI metadata (Apps and Menus) for the authenticated tenant.
 * Returns mock data if the database is empty.
 */
export async function GET() {
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId || process.env.DEFAULT_TENANT_ID;
    const userId = (session.user as any).id || 'anon';
    const cacheKey = `${tenantId}:${userId}`;

    const cached = getConfigCache(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=30', 'X-Cache': 'HIT' }
      });
    }

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

    // 2. Fallback Mock Data if DB is empty — only for authenticated users
    if (apps.length === 0 && session) {
      apps = getMockData();
    } else if (apps.length === 0) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Filter Apps and Menus by Role & System Capability
    const user = session?.user as any;
    const isSuperAdmin = user?.role === 'SUPER_ADMIN'; 
    const isTenantAdmin = user?.role === 'TENANT_ADMIN';
    const isSystemAdmin = isSuperAdmin || isTenantAdmin; // Both Super Admin & Tenant Admin see Admin & Settings menu

    let userCapabilities: string[] = [];

    if (isSystemAdmin) {
      const systemCaps = Object.keys(SYSTEM_PERMISSION_REGISTRY);
      const pkgCaps = await db.capabilityDefinition.findMany({
        where: { isSystem: false },
        select: { key: true }
      });
      userCapabilities = [...systemCaps, ...pkgCaps.map(p => p.key)];
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

    // 5. Fetch Widgets for the Widget Bar
    let widgets: any[] = [];
    try {
      widgets = await db.consoleWidget.findMany({
        where: {
          tenantId,
          enabled: true,
          OR: [
            { appId: null },
            { appId: { in: filteredApps.map(a => a.id) } }
          ]
        },
        orderBy: { order: 'asc' }
      });

      if (!isSystemAdmin) {
        widgets = widgets.filter(w => {
          if (!w.requiredCapability) return true;
          return userCapabilities.includes(w.requiredCapability);
        });
      }
    } catch (err: any) {
      console.warn('[CONFIG] Widget fetch failed (table may not exist yet):', err.message);
    }

    const responseData = {
      success: true,
      _debug: { version: '6.5.0', timestamp: new Date().toISOString(), tenantId },
      data: { apps: filteredApps, widgets }
    };

    setConfigCache(cacheKey, responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Cache': 'MISS'
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
      translationKey: 'app.dashboard',
      icon: 'LayoutDashboard',
      order: 0,
      menus: [
        {
          id: 'mock-menu-overview',
          label: 'Overview',
          translationKey: 'menu.overview',
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
      translationKey: 'app.crm',
      icon: 'Users',
      order: 1,
      menus: [
        {
          id: 'mock-menu-leads',
          label: 'Leads',
          translationKey: 'menu.leads',
          icon: 'Target',
          path: '/table/leads',
          actionType: 'table',
          order: 0,
          children: []
        },
        {
          id: 'mock-menu-customers',
          label: 'Customers',
          translationKey: 'menu.customers',
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
      translationKey: 'app.settings_admin',
      icon: 'Settings',
      order: 99,
      isSystem: true,
      menus: [
        {
          id: 'mock-menu-general',
          label: 'General',
          translationKey: 'menu.general',
          icon: 'Sliders',
          order: 0,
          children: [
            { id: 'm-prof', label: 'Company Profile', translationKey: 'menu.company_profile', icon: 'Building', path: '/admin/profile', order: 0, requiredCapability: 'system.settings.profile', actionType: 'plugin', componentKey: 'AdminCompanyProfile' },
            { id: 'm-gen', label: 'General Settings', translationKey: 'menu.general_settings', icon: 'Settings', path: '/admin/general', order: 1, requiredCapability: 'system.settings.edit', actionType: 'plugin', componentKey: 'AdminGeneralSettings' },
            { id: 'm-bill', label: 'Subscription & Billing', translationKey: 'menu.subscription_billing', icon: 'CreditCard', path: '/admin/billing', order: 2, requiredCapability: 'system.billing.manage', actionType: 'plugin', componentKey: 'AdminBilling' }
          ]
        },
        {
          id: 'mock-menu-users',
          label: 'Users & Team',
          translationKey: 'menu.users_team',
          icon: 'Users',
          order: 1,
          children: [
            { id: 'm-users', label: 'Users', translationKey: 'menu.users', icon: 'UserPlus', path: '/admin/users', order: 0, requiredCapability: 'system.users.manage', actionType: 'plugin', componentKey: 'AdminUserManager' },
            { id: 'm-teams', label: 'Teams', translationKey: 'menu.teams', icon: 'GitBranch', path: '/admin/teams', order: 1, requiredCapability: 'system.teams.manage', actionType: 'plugin', componentKey: 'AdminTeamManager' },
            { id: 'm-roles', label: 'Access Roles', translationKey: 'menu.access_roles', icon: 'ShieldCheck', path: '/admin/roles', order: 2, requiredCapability: 'system.roles.assign', actionType: 'plugin', componentKey: 'AdminPermissions' }
          ]
        },
        {
          id: 'mock-menu-platform',
          label: 'Platform Studio',
          translationKey: 'menu.platform_studio',
          icon: 'Layout',
          order: 2,
          children: [
            { id: 'm-schema', label: 'Data Model', translationKey: 'menu.data_model', icon: 'Database', path: '/admin/schema', order: 0, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminEntityManager' },
            { id: 'm-views', label: 'Layouts', translationKey: 'menu.layouts', icon: 'LayoutTemplate', path: '/admin/views', order: 1, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminViewManager' },
            { id: 'm-workflow', label: 'Workflow', translationKey: 'menu.workflow', icon: 'Workflow', path: '/admin/workflow', order: 2, requiredCapability: 'system.schema.manage', actionType: 'plugin', componentKey: 'AdminWorkflowManager' },
            { id: 'm-apps', label: 'Apps', translationKey: 'menu.apps', icon: 'LayoutGrid', path: '/admin/apps', order: 3, requiredCapability: 'system.apps.manage', actionType: 'plugin', componentKey: 'AdminAppManager' }
          ]
        }
      ]
    }
  ];
}
