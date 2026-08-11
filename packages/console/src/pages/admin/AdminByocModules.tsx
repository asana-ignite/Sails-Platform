import React from 'react';
import { useTranslation } from 'react-i18next';

const AdminByocModules: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="sails-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--sails-text-muted)' }} dangerouslySetInnerHTML={{ __html: t('admin_roadmap.byocModules') }} />
      <div style={{ marginTop: '20px', height: '150px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--sails-radius-md)', border: '1px solid var(--sails-border-color)' }} />
    </div>
  );
};

export default AdminByocModules;
