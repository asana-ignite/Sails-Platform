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
  AdminWorkflowManager: lazy(() => import('../../pages/admin/AdminWorkflowManager')),
  AdminAppManager: lazy(() => import('../../pages/admin/AdminAppManager')),
  LayoutStudio: lazy(() => import('../../pages/custom/LayoutStudio')),
  WorkflowStudio: lazy(() => import('../../pages/custom/WorkflowStudio')),

  // Identity & Security
  AdminSSOConfig: lazy(() => import('../../pages/admin/AdminSSOConfig')),
  AdminApiTokens: lazy(() => import('../../pages/admin/AdminApiTokens')),
  AdminConnectedApps: lazy(() => import('../../pages/admin/AdminConnectedApps')),

  // Extensions
  AdminByocModules: lazy(() => import('../../pages/admin/AdminByocModules')),
  AdminIntegrations: lazy(() => import('../../pages/admin/AdminIntegrations')),

  // Governance
  AdminAuditLog: lazy(() => import('../../pages/admin/AdminAuditLog')),

  // Reporting
  ReportDesigner: lazy(() => import('../../pages/custom/ReportDesigner')),

  // Fallbacks & Tests
  AdminPlaceholder: lazy(() => import('../../pages/admin/AdminPlaceholder')),
  TestPlugin: lazy(() => import('../../pages/admin/AdminTestPlugin')),
};
