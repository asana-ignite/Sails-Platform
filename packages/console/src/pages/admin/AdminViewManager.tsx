import React from 'react';
import { LayoutTemplate } from 'lucide-react';

const AdminViewManager: React.FC = () => {
  return (
    <div className="sails-admin-placeholder">
      <div className="sails-admin-placeholder__icon">
        <LayoutTemplate size={40} />
      </div>
      <p className="sails-admin-placeholder__text">
        This is the <strong>Views</strong> plugin.
      </p>
      <p className="sails-admin-placeholder__subtitle">
        Design and configure views for your data model entities.
      </p>
      <div className="sails-entity-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="sails-entity-item" />
        ))}
      </div>
    </div>
  );
};

export default AdminViewManager;
