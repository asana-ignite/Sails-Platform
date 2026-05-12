/**
 * SYSTEM_PERMISSION_REGISTRY
 * 
 * This file is the Source of Truth for all functional capabilities in the INIDOS platform.
 * It is used by the backend to verify access and by the Admin UI to render permission toggles.
 * 
 * Pattern: system.<module>.<action>
 */

export interface PermissionDefinition {
  label: string;
  description: string;
  category: 'IAM' | 'Platform' | 'Operations' | 'Security' | 'Extensions';
}

export const SYSTEM_PERMISSION_REGISTRY: Record<string, PermissionDefinition> = {
  // --- Identity & Access Management ---
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

  // --- Platform Studio (formerly Architecture) ---
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

  // --- Identity & Security ---
  'system.security.sso': {
    label: 'Configure SSO',
    description: 'Manage SAML, OIDC, and Enterprise Identity Providers.',
    category: 'Security'
  },
  'system.security.tokens': {
    label: 'Personal Access Tokens',
    description: 'Issue and revoke long-lived API tokens and keys.',
    category: 'Security'
  },
  'system.security.apps': {
    label: 'Connected Apps',
    description: 'Authorize and manage third-party application access.',
    category: 'Security'
  },

  // --- Extensions & Integrations ---
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

  // --- Operations & Governance ---
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

/**
 * Helper to get all permission keys
 */
export type SystemCapability = keyof typeof SYSTEM_PERMISSION_REGISTRY;

export const getAllCapabilities = () => Object.keys(SYSTEM_PERMISSION_REGISTRY) as SystemCapability[];
