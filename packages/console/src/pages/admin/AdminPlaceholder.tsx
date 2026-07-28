import React from 'react';
import { useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';

const AdminPlaceholder: React.FC = () => {
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
          This administrative module is part of the <strong>Phase 6 Roadmap</strong>.
          <br />
          Currently connected to the <code>{location.pathname}</code> endpoint.
        </p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
