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
    <div className="inidos-admin-placeholder">
      <div className="inidos-admin-placeholder__icon">
        <Settings size={40} />
      </div>
      <div className="inidos-admin-placeholder__content">
        <h1 className="inidos-admin-placeholder__title">{formattedName}</h1>
        <p className="inidos-admin-placeholder__text">
          This administrative module is part of the <strong>Phase 6 Roadmap</strong>.
          <br />
          Currently connected to the <code>{location.pathname}</code> endpoint.
        </p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
