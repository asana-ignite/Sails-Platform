/**
 * System permissions — the static registry of platform capability keys.
 *
 * Every entry is a `system.<category>.<action>` key that admin UI surfaces
 * (permission panels, admin apps, menus) use to gate features. The registry
 * here is the display metadata (label/description/category); enforcement and
 * tenant assignment happen server-side via core.object_permissions.
 */
export interface PermissionDefinition {
  label: string;
  description: string;
  translationKey?: string;
  category: 'IAM' | 'Platform' | 'Operations' | 'Security' | 'Extensions';
}

export const SYSTEM_PERMISSION_REGISTRY: Record<string, PermissionDefinition> = {
  'system.users.manage': {
    label: 'Manage Users',
    description: 'Invite new users, edit profiles, and deactivate accounts.',
    category: 'IAM'
  },
  'system.teams.manage': {
    label: 'Manage Teams',
    description: 'Create and modify teams, hierarchy, and department structures.',
    category: 'IAM'
  },
  'system.roles.assign': {
    label: 'Assign Roles',
    description: 'Change user roles (e.g., promote a user to Tenant Admin).',
    category: 'IAM'
  },

  'system.schema.manage': {
    label: 'Manage Schema',
    description: 'Create and modify Entities (Tables) and Fields (Columns).',
    category: 'Platform'
  },
  'system.apps.manage': {
    label: 'Manage Console Apps',
    description: 'Create, rename, and reorder Apps in the App Switcher.',
    category: 'Platform'
  },
  'system.menus.manage': {
    label: 'Manage Navigation',
    description: 'Add or remove links and folders in the sidebar navigation.',
    category: 'Platform'
  },
  'system.workflow.manage': {
    label: 'Manage Workflows',
    description: 'Design and automate business workflows across the platform.',
    category: 'Platform'
  },

  'system.security.sso': {
    label: 'Login & Single Sign-On',
    description: 'Manage internal login policies, Google, Entra, and Enterprise Identity Providers.',
    category: 'Security'
  },
  'system.security.tokens': {
    label: 'API & Service Tokens',
    description: 'Issue and revoke long-lived API tokens and service keys.',
    category: 'Security'
  },
  'system.security.apps': {
    label: 'Connected Apps',
    description: 'Authorize and manage third-party application access.',
    category: 'Extensions'
  },

  'system.extensions.byoc': {
    label: 'Custom Modules (BYOC)',
    description: 'Upload and manage custom JavaScript logic (.js) files.',
    category: 'Extensions'
  },
  'system.integrations.api': {
    label: 'API & Webhooks',
    description: 'Configure external integrations (ERP, LINE OA) and webhook endpoints.',
    category: 'Extensions'
  },

  'system.settings.profile': {
    label: 'Company Profile',
    description: 'Manage company branding, legal information, and address.',
    category: 'Operations'
  },
  'system.settings.edit': {
    label: 'Edit Tenant Settings',
    description: 'Change branding, locale, timezone, and platform defaults.',
    category: 'Operations'
  },
  'system.audit.view': {
    label: 'View Audit Logs',
    description: 'Access the full system-wide history of data and schema changes.',
    category: 'Operations'
  },

  'system.billing.manage': {
    label: 'Manage Billing',
    description: 'Access invoices, change subscription plans, and update payment methods.',
    category: 'Operations'
  }
};

export type SystemCapability = keyof typeof SYSTEM_PERMISSION_REGISTRY;

export const getAllCapabilities = () => Object.keys(SYSTEM_PERMISSION_REGISTRY) as SystemCapability[];
