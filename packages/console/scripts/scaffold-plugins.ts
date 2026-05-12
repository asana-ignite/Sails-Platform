import fs from 'fs';
import path from 'path';

const components = [
  { name: 'AdminCompanyProfile', label: 'Company Profile' },
  { name: 'AdminGeneralSettings', label: 'General Settings' },
  { name: 'AdminBilling', label: 'Subscription & Billing' },
  { name: 'AdminUserManager', label: 'Users' },
  { name: 'AdminTeamManager', label: 'Teams' },
  { name: 'AdminEntityManager', label: 'Data Model' },
  { name: 'AdminAppManager', label: 'Console Apps' },
  { name: 'AdminMenuManager', label: 'Navigation Menus' },
  { name: 'AdminSSOConfig', label: 'SSO Configuration' },
  { name: 'AdminApiTokens', label: 'API Tokens' },
  { name: 'AdminConnectedApps', label: 'Connected Apps' },
  { name: 'AdminByocModules', label: 'Custom Modules (BYOC)' },
  { name: 'AdminIntegrations', label: 'API & Webhooks' },
  { name: 'AdminAuditLog', label: 'Audit History' }
];

const targetDir = '/Users/asana/INIDOS/inidos-console/src/pages/admin';

const template = (name: string, label: string) => `import React from 'react';

/**
 * ${label} Plugin (Scaffold)
 * Part of Phase 6 Roadmap
 */
const ${name}: React.FC = () => {
  return (
    <div className="inidos-admin-scaffold" style={{ padding: '20px' }}>
      <div style={{ 
        padding: '30px', 
        border: '1px dashed var(--inidos-border-color)', 
        borderRadius: 'var(--inidos-radius-lg)',
        background: 'rgba(255,255,255,0.3)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '10px', color: 'var(--inidos-text-main)' }}>${label} Module</h2>
        <p style={{ color: 'var(--inidos-text-muted)', maxWidth: '500px', margin: '0 auto' }}>
          This is a scaffolded component for the <strong>${label}</strong> administrative plugin. 
          Ready for implementation logic, data fetching, and UI controls.
        </p>
        
        <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--inidos-radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>WIDGET SLOT {i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ${name};
`;

components.forEach(comp => {
  const filePath = path.join(targetDir, `${comp.name}.tsx`);
  fs.writeFileSync(filePath, template(comp.name, comp.label));
  console.log(`✅ Created ${filePath}`);
});
