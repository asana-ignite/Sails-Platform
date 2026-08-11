import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';

const AdminPlaceholder: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionName = pathParts[pathParts.length - 1] || 'Settings';

  const formattedName = sectionName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="sails-admin-placeholder">
      <div className="sails-admin-placeholder__icon">
        <Settings size={40} />
      </div>
      <div className="sails-admin-placeholder__content">
        <h1 className="sails-admin-placeholder__title">{formattedName}</h1>
        <p className="sails-admin-placeholder__text">
          <span dangerouslySetInnerHTML={{ __html: t('admin_roadmap.phaseMessage') }} />
          <br />
          <span dangerouslySetInnerHTML={{ __html: t('admin_roadmap.endpointMessage', { path: location.pathname }) }} />
        </p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
