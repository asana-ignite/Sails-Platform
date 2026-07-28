import { db } from '../lib/db';
import { AlchemaCore } from '../core/engine/AlchemaCore';
import { Pool } from 'pg';
import { ConnectionManager } from '../core/engine/ConnectionManager';
import { ProvisionTenantResponse } from '@sails/shared';
import { TranslatorLayer } from './TranslatorLayer';

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

  async provisionTenant(name: string, adminEmail?: string, existingUserId?: string): Promise<ProvisionTenantResponse> {
    if (!adminEmail && !existingUserId) throw new Error('Either adminEmail or existingUserId must be provided.');
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
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Welcome2Ignite', 10);
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
        icon: 'Settings',
        order: 99,
        requiredCapability: 'ADMIN',
        menus: {
          create: [
            {
              label: 'General', icon: 'Sliders', order: 0, actionType: 'plugin',
              children: {
                create: [
                  { label: 'Company Profile', icon: 'Building', path: '/admin/profile', order: 0, requiredCapability: 'system.settings.profile', componentKey: 'AdminCompanyProfile', actionType: 'plugin' },
                  { label: 'General Settings', icon: 'Settings', path: '/admin/general', order: 1, requiredCapability: 'system.settings.edit', componentKey: 'AdminGeneralSettings', actionType: 'plugin' },
                  { label: 'Subscription & Billing', icon: 'CreditCard', path: '/admin/billing', order: 2, requiredCapability: 'system.billing.manage', componentKey: 'AdminBilling', actionType: 'plugin' }
                ]
              }
            },
            {
              label: 'Users & Team', icon: 'Users', order: 1, actionType: 'plugin',
              children: {
                create: [
                  { label: 'Users', icon: 'UserPlus', path: '/admin/users', order: 0, requiredCapability: 'system.users.manage', componentKey: 'AdminUserManager', actionType: 'plugin' },
                  { label: 'Positions', icon: 'Award', path: '/admin/positions', order: 1, requiredCapability: 'system.users.manage', componentKey: 'AdminPositionManager', actionType: 'plugin' },
                  { label: 'Teams', icon: 'GitBranch', path: '/admin/teams', order: 2, requiredCapability: 'system.teams.manage', componentKey: 'AdminTeamManager', actionType: 'plugin' },
                  { label: 'Access Roles', icon: 'ShieldCheck', path: '/admin/roles', order: 3, requiredCapability: 'system.roles.assign', componentKey: 'AdminPermissions', actionType: 'plugin' }
                ]
              }
            },
            {
              label: 'Platform Studio', icon: 'Layout', order: 2, actionType: 'plugin',
              children: {
                create: [
                  { label: 'Data Model', icon: 'Database', path: '/admin/schema', order: 0, requiredCapability: 'system.schema.manage', componentKey: 'AdminEntityManager', actionType: 'plugin' },
                  { label: 'Views', icon: 'LayoutTemplate', path: '/admin/views', order: 1, requiredCapability: 'system.schema.manage', componentKey: 'AdminViewManager', actionType: 'plugin' },
                  { label: 'Console Apps', icon: 'LayoutGrid', path: '/admin/apps', order: 2, requiredCapability: 'system.apps.manage', componentKey: 'AdminAppManager', actionType: 'plugin' },
                  { label: 'Navigation Menus', icon: 'Menu', path: '/admin/menus', order: 3, requiredCapability: 'system.menus.manage', componentKey: 'AdminMenuManager', actionType: 'plugin' }
                ]
              }
            },
            {
              label: 'Login & Security', icon: 'ShieldCheck', order: 3, actionType: 'plugin',
              children: {
                create: [
                  { label: 'Login & Single Sign-On', icon: 'Key', path: '/admin/sso', order: 0, requiredCapability: 'system.security.sso', componentKey: 'AdminSSOConfig', actionType: 'plugin' },
                  { label: 'API & Service Tokens', icon: 'FileDigit', path: '/admin/tokens', order: 1, requiredCapability: 'system.security.tokens', componentKey: 'AdminApiTokens', actionType: 'plugin' },
                  { label: 'Audit History', icon: 'FileClock', path: '/admin/audit', order: 2, requiredCapability: 'system.audit.view', componentKey: 'AdminAuditLog', actionType: 'plugin' }
                ]
              }
            },
            {
              label: 'Integrations & Apps', icon: 'Blocks', order: 4, actionType: 'plugin',
              children: {
                create: [
                  { label: 'Connected Apps', icon: 'Link', path: '/admin/connected-apps', order: 0, requiredCapability: 'system.security.apps', componentKey: 'AdminConnectedApps', actionType: 'plugin' },
                  { label: 'API & Webhooks', icon: 'Webhook', path: '/admin/integrations', order: 1, requiredCapability: 'system.integrations.api', componentKey: 'AdminIntegrations', actionType: 'plugin' },
                  { label: 'Custom Modules (BYOC)', icon: 'Code2', path: '/admin/byoc', order: 2, requiredCapability: 'system.extensions.byoc', componentKey: 'AdminByocModules', actionType: 'plugin' }
                ]
              }
            }
          ]
        }
      }
    });

    await db.$executeRawUnsafe(`
      UPDATE core.console_menus 
      SET app_id = '${adminApp.id}' 
      WHERE parent_id IN (SELECT id FROM core.console_menus WHERE app_id = '${adminApp.id}')
    `);

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
          tenantId, name: 'Dashboard', icon: 'LayoutDashboard', order: 0,
          menus: { create: [{ label: 'Overview', icon: 'Activity', path: '/dashboard', order: 0, actionType: 'plugin' }] }
        }
      });
    }

    // CRM
    if (!existingNames.includes('CRM')) {
      await db.consoleApp.create({
        data: {
          tenantId, name: 'CRM', icon: 'Users', order: 1,
          menus: {
            create: [
              {
                label: 'Intelligence', icon: 'Zap', order: 0, actionType: 'plugin',
                children: {
                  create: [
                    { label: 'Leads', icon: 'Target', path: '/crm/leads', order: 0, actionType: 'table' },
                    { label: 'Pipeline', icon: 'GitMerge', path: '/crm/pipeline', order: 1, actionType: 'plugin' }
                  ]
                }
              },
              {
                label: 'Accounts', icon: 'Building', order: 1, actionType: 'plugin',
                children: {
                  create: [
                    { label: 'Customers', icon: 'UserCheck', path: '/crm/customers', order: 0, actionType: 'table' },
                    { label: 'Companies', icon: 'Briefcase', path: '/crm/companies', order: 1, actionType: 'table' }
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
          tenantId, name: 'Sales', icon: 'DollarSign', order: 2,
          menus: {
            create: [
              {
                label: 'Transactions', icon: 'ShoppingCart', order: 0, actionType: 'plugin',
                children: {
                  create: [
                    { label: 'Orders', icon: 'sales/orders', order: 0, actionType: 'table' },
                    { label: 'Invoices', icon: 'sales/invoices', order: 1, actionType: 'table' }
                  ]
                }
              }
            ]
          }
        }
      });
    }

    // Fix appId for all business apps
    await db.$executeRawUnsafe(`
      UPDATE core.console_menus 
      SET app_id = parent_id_table.app_id
      FROM core.console_menus AS parent_id_table
      WHERE core.console_menus.parent_id = parent_id_table.id
      AND core.console_menus.app_id IS NULL
    `);
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
}
