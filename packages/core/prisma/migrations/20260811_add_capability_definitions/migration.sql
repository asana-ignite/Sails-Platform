-- CreateTable
CREATE TABLE core.capability_definitions (
    id TEXT NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    package_id TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT capability_definitions_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE UNIQUE INDEX capability_definitions_key_key ON core.capability_definitions(key);

-- Seed existing system capabilities
INSERT INTO core.capability_definitions (id, key, label, description, category, package_id, is_system)
VALUES
  (gen_random_uuid(), 'system.users.manage',       'Manage Users',              'Invite new users, edit profiles, and deactivate accounts.',                                   'IAM',         'system', true),
  (gen_random_uuid(), 'system.teams.manage',       'Manage Teams',              'Create and modify teams, hierarchy, and department structures.',                             'IAM',         'system', true),
  (gen_random_uuid(), 'system.roles.assign',       'Assign Roles',              'Change user roles (e.g., promote a user to Tenant Admin).',                                  'IAM',         'system', true),
  (gen_random_uuid(), 'system.schema.manage',      'Manage Schema',             'Create and modify Entities (Tables) and Fields (Columns).',                                   'Platform',    'system', true),
  (gen_random_uuid(), 'system.apps.manage',        'Manage Console Apps',       'Create, rename, and reorder Apps in the App Switcher.',                                      'Platform',    'system', true),
  (gen_random_uuid(), 'system.menus.manage',       'Manage Navigation',         'Add or remove links and folders in the sidebar navigation.',                                  'Platform',    'system', true),
  (gen_random_uuid(), 'system.workflow.manage',    'Manage Workflows',          'Design and automate business workflows across the platform.',                                 'Platform',    'system', true),
  (gen_random_uuid(), 'system.security.sso',       'Login & Single Sign-On',    'Manage internal login policies, Google, Entra, and Enterprise Identity Providers.',           'Security',    'system', true),
  (gen_random_uuid(), 'system.security.tokens',    'API & Service Tokens',      'Issue and revoke long-lived API tokens and service keys.',                                   'Security',    'system', true),
  (gen_random_uuid(), 'system.security.apps',      'Connected Apps',            'Authorize and manage third-party application access.',                                       'Extensions',  'system', true),
  (gen_random_uuid(), 'system.extensions.byoc',    'Custom Modules (BYOC)',     'Upload and manage custom JavaScript logic (.js) files.',                                     'Extensions',  'system', true),
  (gen_random_uuid(), 'system.integrations.api',   'API & Webhooks',            'Configure external integrations (ERP, LINE OA) and webhook endpoints.',                      'Extensions',  'system', true),
  (gen_random_uuid(), 'system.settings.profile',   'Company Profile',           'Manage company branding, legal information, and address.',                                   'Operations',  'system', true),
  (gen_random_uuid(), 'system.settings.edit',      'Edit Tenant Settings',      'Change branding, locale, timezone, and platform defaults.',                                  'Operations',  'system', true),
  (gen_random_uuid(), 'system.audit.view',         'View Audit Logs',           'Access the full system-wide history of data and schema changes.',                            'Operations',  'system', true),
  (gen_random_uuid(), 'system.billing.manage',     'Manage Billing',            'Access invoices, change subscription plans, and update payment methods.',                    'Operations',  'system', true)
ON CONFLICT (key) DO NOTHING;
