import { db } from '../lib/db';
import { AlchemaCore } from '../core/engine/AlchemaCore';
import { Pool } from 'pg';
import { ConnectionManager } from '../core/engine/ConnectionManager';
import { ProvisionTenantResponse } from '@sails/shared';
import { TranslatorLayer } from './TranslatorLayer';
import { PACKAGE_MANIFESTS, getAllPackageCapabilityDefinitions } from '@sails/shared';
import bcrypt from 'bcryptjs';

export class TenantProvisioner {
  private engine: AlchemaCore;
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || ConnectionManager.getInstance().getCorePool();
    this.engine = new AlchemaCore(this.pool);
  }

  private normalizeSchemaName(name: string): string {
    return 'tenant_' + name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private async generateUniqueSchemaName(baseName: string): Promise<string> {
    let schemaName = baseName;
    let counter = 1;
    while (true) {
      const exists = await db.tenant.findUnique({ where: { schemaName: schemaName } });
      if (!exists) return schemaName;
      schemaName = `${baseName}_${counter}`;
      counter++;
    }
  }

  async provisionTenant(name: string, adminEmail?: string, existingUserId?: string, password?: string): Promise<ProvisionTenantResponse> {
    if (!adminEmail && !existingUserId) throw new Error('Either adminEmail or existingUserId must be provided.');
    if (!existingUserId && !password) throw new Error('Password is required when creating a new admin user.');
    const baseSchemaName = this.normalizeSchemaName(name);
    const uniqueSchemaName = await this.generateUniqueSchemaName(baseSchemaName);

    await this.engine.createTenantSchema(uniqueSchemaName);

    const tenant = await db.tenant.create({
      data: {
        name: name,
        schemaName: uniqueSchemaName,
        teams: { create: [{ name: 'System Administrator', isSystemAdmin: true }] }
      },
      include: { teams: true }
    });

    const adminTeam = tenant.teams[0];

    let user;
    if (existingUserId) {
      user = await db.user.update({
        where: { id: existingUserId },
        data: { tenantId: tenant.id, teams: { create: { teamId: adminTeam.id, isLeader: true } } }
      });
    } else {
      const hash = await bcrypt.hash(password!, 12);
      user = await db.user.create({
        data: {
          email: adminEmail!,
          password: hash,
          tenantId: tenant.id,
          role: 'TENANT_ADMIN',
          teams: { create: { teamId: adminTeam.id, isLeader: true } }
        }
      });
    }

    await this.provisionSystemApps(tenant.id);
    await this.provisionBusinessApps(tenant.id);
    await this.provisionDefaultWidgets(tenant.id);
    await this.provisionStandardDataModels(tenant.id);
    
    return {
      tenant: tenant as any,
      user: user as any,
      adminTeam: adminTeam as any
    };
  }

  /**
   * Provision "Settings & Admin" with clean /admin/ paths
   */
  async provisionSystemApps(tenantId: string) {
    const existing = await db.consoleApp.findFirst({
      where: { tenantId, name: 'Settings & Admin' }
    });

    if (existing) {
      console.log(`[PROVISIONER] 'Settings & Admin' already exists for tenant ${tenantId}. Skipping.`);
      return existing;
    }

    const adminApp = await db.consoleApp.create({
      data: {
        tenantId,
        name: 'Settings & Admin',
        translationKey: 'app.settings_admin',
        icon: 'Settings',
        order: 99,
        isSystem: true,
        requiredCapability: 'ADMIN',
        menus: {
          create: [
            {
              label: 'General', translationKey: 'menu.general', icon: 'Sliders', order: 0, actionType: 'plugin', tenantId,
              children: {
                create: [
                  { label: 'Company Profile', translationKey: 'menu.company_profile', icon: 'Building', path: '/admin/profile', order: 0, requiredCapability: 'system.settings.profile', componentKey: 'AdminCompanyProfile', actionType: 'plugin', tenantId },
                  { label: 'General Settings', translationKey: 'menu.general_settings', icon: 'Settings', path: '/admin/general', order: 1, requiredCapability: 'system.settings.edit', componentKey: 'AdminGeneralSettings', actionType: 'plugin', tenantId },
                  { label: 'Subscription & Billing', translationKey: 'menu.subscription_billing', icon: 'CreditCard', path: '/admin/billing', order: 2, requiredCapability: 'system.billing.manage', componentKey: 'AdminBilling', actionType: 'plugin', tenantId }
                ]
              }
            },
            {
              label: 'Users & Team', translationKey: 'menu.users_team', icon: 'Users', order: 1, actionType: 'plugin', tenantId,
              children: {
                create: [
                  { label: 'Users', translationKey: 'menu.users', icon: 'UserPlus', path: '/admin/users', order: 0, requiredCapability: 'system.users.manage', componentKey: 'AdminUserManager', actionType: 'plugin', tenantId },
                  { label: 'Positions', translationKey: 'menu.positions', icon: 'Award', path: '/admin/positions', order: 1, requiredCapability: 'system.users.manage', componentKey: 'AdminPositionManager', actionType: 'plugin', tenantId },
                  { label: 'Teams', translationKey: 'menu.teams', icon: 'GitBranch', path: '/admin/teams', order: 2, requiredCapability: 'system.teams.manage', componentKey: 'AdminTeamManager', actionType: 'plugin', tenantId },
                  { label: 'Access Roles', translationKey: 'menu.access_roles', icon: 'ShieldCheck', path: '/admin/roles', order: 3, requiredCapability: 'system.roles.assign', componentKey: 'AdminPermissions', actionType: 'plugin', tenantId }
                ]
              }
            },
            {
              label: 'Platform Studio', translationKey: 'menu.platform_studio', icon: 'Layout', order: 2, actionType: 'plugin', tenantId,
              children: {
                create: [
                  { label: 'Data Model', translationKey: 'menu.data_model', icon: 'Database', path: '/admin/schema', order: 0, requiredCapability: 'system.schema.manage', componentKey: 'AdminEntityManager', actionType: 'plugin', tenantId },
                  { label: 'Layouts', translationKey: 'menu.layouts', icon: 'LayoutTemplate', path: '/admin/views', order: 1, requiredCapability: 'system.schema.manage', componentKey: 'AdminViewManager', actionType: 'plugin', tenantId },
                  { label: 'Workflow', translationKey: 'menu.workflow', icon: 'Workflow', path: '/admin/workflow', order: 2, requiredCapability: 'system.schema.manage', componentKey: 'AdminWorkflowManager', actionType: 'plugin', tenantId },
                  { label: 'Apps', translationKey: 'menu.apps', icon: 'LayoutGrid', path: '/admin/apps', order: 3, requiredCapability: 'system.apps.manage', componentKey: 'AdminAppManager', actionType: 'plugin', tenantId }
                ]
              }
            },
            {
              label: 'Login & Security', translationKey: 'menu.login_security', icon: 'ShieldCheck', order: 3, actionType: 'plugin', tenantId,
              children: {
                create: [
                  { label: 'Login & Single Sign-On', translationKey: 'menu.login_sso', icon: 'Key', path: '/admin/sso', order: 0, requiredCapability: 'system.security.sso', componentKey: 'AdminSSOConfig', actionType: 'plugin', tenantId },
                  { label: 'API & Service Tokens', translationKey: 'menu.api_tokens', icon: 'FileDigit', path: '/admin/tokens', order: 1, requiredCapability: 'system.security.tokens', componentKey: 'AdminApiTokens', actionType: 'plugin', tenantId },
                  { label: 'Audit History', translationKey: 'menu.audit_history', icon: 'FileClock', path: '/admin/audit', order: 2, requiredCapability: 'system.audit.view', componentKey: 'AdminAuditLog', actionType: 'plugin', tenantId }
                ]
              }
            },
            {
              label: 'Integrations & Apps', translationKey: 'menu.integrations_apps', icon: 'Blocks', order: 4, actionType: 'plugin', tenantId,
              children: {
                create: [
                  { label: 'Connected Apps', translationKey: 'menu.connected_apps', icon: 'Link', path: '/admin/connected-apps', order: 0, requiredCapability: 'system.security.apps', componentKey: 'AdminConnectedApps', actionType: 'plugin', tenantId },
                  { label: 'API & Webhooks', translationKey: 'menu.api_webhooks', icon: 'Webhook', path: '/admin/integrations', order: 1, requiredCapability: 'system.integrations.api', componentKey: 'AdminIntegrations', actionType: 'plugin', tenantId },
                  { label: 'Custom Modules (BYOC)', translationKey: 'menu.custom_modules_byoc', icon: 'Code2', path: '/admin/byoc', order: 2, requiredCapability: 'system.extensions.byoc', componentKey: 'AdminByocModules', actionType: 'plugin', tenantId }
                ]
              }
            }
          ]
        }
      }
    });

    await db.$executeRaw`
      UPDATE core.console_menus 
      SET app_id = ${adminApp.id}
      WHERE parent_id IN (SELECT id FROM core.console_menus WHERE app_id = ${adminApp.id})
    `;

    return adminApp;
  }

  async provisionBusinessApps(tenantId: string) {
    const appsToProvision = ['CRM', 'Sales', 'Dashboard'];
    const existingApps = await db.consoleApp.findMany({
      where: { tenantId, name: { in: appsToProvision } }
    });

    if (existingApps.length === appsToProvision.length) {
      console.log(`[PROVISIONER] All business apps already exist for tenant ${tenantId}. Skipping.`);
      return;
    }

    const existingNames = existingApps.map(a => a.name);

    // Dashboard
    if (!existingNames.includes('Dashboard')) {
      await db.consoleApp.create({
        data: {
          tenantId, name: 'Dashboard', translationKey: 'app.dashboard', icon: 'LayoutDashboard', order: 0,
          menus: { create: [{ label: 'Overview', translationKey: 'menu.overview', icon: 'Activity', path: '/dashboard', order: 0, actionType: 'plugin', tenantId }] }
        }
      });
    }

    // CRM
    if (!existingNames.includes('CRM')) {
      await db.consoleApp.create({
        data: {
          tenantId, name: 'CRM', translationKey: 'app.crm', icon: 'Users', order: 1,
          menus: {
            create: [
              {
                label: 'Intelligence', translationKey: 'menu.intelligence', icon: 'Zap', order: 0, actionType: 'plugin', tenantId,
                children: {
                  create: [
                    { label: 'Leads', translationKey: 'menu.leads', icon: 'Target', path: '/crm/leads', order: 0, actionType: 'table', tenantId },
                    { label: 'Pipeline', translationKey: 'menu.pipeline', icon: 'GitMerge', path: '/crm/pipeline', order: 1, actionType: 'plugin', tenantId }
                  ]
                }
              },
              {
                label: 'Accounts', translationKey: 'menu.accounts', icon: 'Building', order: 1, actionType: 'plugin', tenantId,
                children: {
                  create: [
                    { label: 'Customers', translationKey: 'menu.customers', icon: 'UserCheck', path: '/crm/customers', order: 0, actionType: 'table', tenantId },
                    { label: 'Companies', translationKey: 'menu.companies', icon: 'Briefcase', path: '/crm/companies', order: 1, actionType: 'table', tenantId }
                  ]
                }
              }
            ]
          }
        }
      });
    }

    // Sales
    if (!existingNames.includes('Sales')) {
      await db.consoleApp.create({
        data: {
          tenantId, name: 'Sales', translationKey: 'app.sales', icon: 'DollarSign', order: 2,
          menus: {
            create: [
              {
                label: 'Transactions', translationKey: 'menu.transactions', icon: 'ShoppingCart', order: 0, actionType: 'plugin', tenantId,
                children: {
                  create: [
                    { label: 'Orders', translationKey: 'menu.orders', icon: 'sales/orders', order: 0, actionType: 'table', tenantId },
                    { label: 'Invoices', translationKey: 'menu.invoices', icon: 'sales/invoices', order: 1, actionType: 'table', tenantId }
                  ]
                }
              }
            ]
          }
        }
      });
    }

    await db.$executeRaw`
      UPDATE core.console_menus 
      SET app_id = parent_id_table.app_id
      FROM core.console_menus AS parent_id_table
      WHERE core.console_menus.parent_id = parent_id_table.id
      AND core.console_menus.app_id IS NULL
    `;
  }

  async provisionDefaultWidgets(tenantId: string) {
    const existingWidgets = await db.consoleWidget.findMany({
      where: { tenantId }
    });

    if (existingWidgets.length > 0) {
      console.log(`[PROVISIONER] Widgets already exist for tenant ${tenantId}. Skipping.`);
      return;
    }

    await db.consoleWidget.createMany({
      data: [
        {
          tenantId,
          label: 'Quick Accept',
          translationKey: 'widget.quick_accept',
          icon: 'CheckCircle',
          componentKey: 'OmniChannelQuickAccept',
          openIn: 'bar',
          order: 0,
          enabled: true,
          isSystem: true,
          requiredCapability: 'ADMIN'
        },
        {
          tenantId,
          label: 'Agent Chat',
          translationKey: 'widget.agent_chat',
          icon: 'MessageSquare',
          componentKey: 'AgentChatWindows',
          openIn: 'bar',
          order: 1,
          enabled: true,
          isSystem: true,
          requiredCapability: 'ADMIN'
        }
      ]
    });

    console.log(`[PROVISIONER] Seeded default widgets for tenant ${tenantId}`);
  }

  async provisionStandardDataModels(tenantId: string) {
    const translator = new TranslatorLayer(this.engine);
    const standardModels = [
      { name: 'Leads', tableName: 'leads', description: 'Sales leads and prospective clients' },
      { name: 'Customers', tableName: 'customers', description: 'Active client accounts' },
      { name: 'Companies', tableName: 'companies', description: 'Business entities and organizations' },
      { name: 'Orders', tableName: 'orders', description: 'Customer purchase orders' },
      { name: 'Invoices', tableName: 'invoices', description: 'Billing and payment invoices' },
    ];

    for (const model of standardModels) {
      const existing = await db.tableDefinition.findFirst({
        where: { tenantId, tableName: model.tableName }
      });
      if (!existing) {
        try {
          await translator.createTable(tenantId, model.name, model.tableName, model.description, true);
          console.log(`[PROVISIONER] Provisioned standard data model: ${model.name}`);
        } catch (e: any) {
          console.warn(`[PROVISIONER] Could not provision standard model ${model.name}:`, e?.message);
        }
      }
    }
  }

  async activatePackage(tenantId: string, packageId: string) {
    const manifest = PACKAGE_MANIFESTS[packageId];
    if (!manifest) {
      throw new Error(`Unknown package: ${packageId}`);
    }

    const adminApp = await db.consoleApp.findFirst({
      where: { tenantId, name: 'Settings & Admin' }
    });
    if (!adminApp) {
      throw new Error('Settings & Admin app not found for this tenant. Provisioning may not be complete.');
    }

    const existingSection = await db.consoleMenu.findFirst({
      where: { appId: adminApp.id, label: manifest.category, tenantId }
    });
    if (existingSection) {
      console.log(`[PROVISIONER] Package "${packageId}" admin section already exists for tenant ${tenantId}.`);
      return existingSection;
    }

    const maxOrder = await db.consoleMenu.aggregate({
      where: { appId: adminApp.id, parentId: null, tenantId },
      _max: { order: true }
    });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    await db.consoleMenu.create({
      data: {
        appId: adminApp.id,
        tenantId,
        label: manifest.category,
        icon: manifest.icon,
        order: nextOrder,
        isSystem: true,
        actionType: 'plugin',
        children: {
          create: manifest.adminMenus.map(menu => ({
            tenantId,
            label: menu.label,
            icon: menu.icon,
            path: menu.path,
            order: 0,
            actionType: 'plugin',
            componentKey: menu.componentKey,
            requiredCapability: menu.requiredCapability,
          }))
        }
      }
    });

    console.log(`[PROVISIONER] Activated package "${packageId}" for tenant ${tenantId}`);
  }

  async getActivePackages(tenantId: string): Promise<string[]> {
    const adminApp = await db.consoleApp.findFirst({
      where: { tenantId, name: 'Settings & Admin' }
    });
    if (!adminApp) return [];

    const sections = await db.consoleMenu.findMany({
      where: { appId: adminApp.id, parentId: null, tenantId },
      select: { label: true }
    });

    const active: string[] = [];
    for (const [pkgId, manifest] of Object.entries(PACKAGE_MANIFESTS)) {
      if (sections.some(s => s.label === manifest.category)) {
        active.push(pkgId);
      }
    }
    return active;
  }

  async seedPackageCapabilityDefinitions(packageId: string) {
    const manifest = PACKAGE_MANIFESTS[packageId];
    if (!manifest) {
      throw new Error(`Unknown package: ${packageId}`);
    }

    for (const cap of manifest.capabilities) {
      await db.capabilityDefinition.upsert({
        where: { key: cap.key },
        update: { label: cap.label, description: cap.description, category: manifest.category },
        create: {
          key: cap.key,
          label: cap.label,
          description: cap.description,
          category: manifest.category,
          packageId: packageId,
          isSystem: false,
        }
      });
    }
  }
}
