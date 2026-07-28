import { lazy } from 'react';

/**
 * Registry of all dynamic administrative components.
 * Keys match the 'componentKey' stored in the core.console_menus metadata.
 */
export const AdminPluginRegistry: Record<string, any> = {
  // General
  AdminCompanyProfile: lazy(() => import('../../pages/admin/AdminCompanyProfile')),
  AdminGeneralSettings: lazy(() => import('../../pages/admin/AdminGeneralSettings')),
  AdminBilling: lazy(() => import('../../pages/admin/AdminBilling')),

  // Users & Team
  AdminUserManager: lazy(() => import('../../pages/custom/UserManager')),
  AdminTeamManager: lazy(() => import('../../pages/admin/AdminTeamManager')),
  AdminPositionManager: lazy(() => import('../../pages/admin/AdminPositionManager')),
  AdminPermissions: lazy(() => import('../../pages/admin/AdminPermissions')),

  // Platform Studio
  AdminEntityManager: lazy(() => import('../../pages/custom/ObjectManager')),
  AdminViewManager: lazy(() => import('../../pages/admin/AdminViewManager')),
  AdminAppManager: lazy(() => import('../../pages/admin/AdminAppManager')),
  AdminMenuManager: lazy(() => import('../../pages/admin/AdminMenuManager')),

  // Identity & Security
  AdminSSOConfig: lazy(() => import('../../pages/admin/AdminSSOConfig')),
  AdminApiTokens: lazy(() => import('../../pages/admin/AdminApiTokens')),
  AdminConnectedApps: lazy(() => import('../../pages/admin/AdminConnectedApps')),

  // Extensions
  AdminByocModules: lazy(() => import('../../pages/admin/AdminByocModules')),
  AdminIntegrations: lazy(() => import('../../pages/admin/AdminIntegrations')),

  // Governance
  AdminAuditLog: lazy(() => import('../../pages/admin/AdminAuditLog')),

  // Fallbacks & Tests
  AdminPlaceholder: lazy(() => import('../../pages/admin/AdminPlaceholder')),
  TestPlugin: lazy(() => import('../../pages/admin/AdminTestPlugin')),
};
