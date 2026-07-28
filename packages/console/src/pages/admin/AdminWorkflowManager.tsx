import React from 'react';
import { Workflow } from 'lucide-react';

const AdminWorkflowManager: React.FC = () => {
  return (
    <div className="sails-admin-placeholder">
      <div className="sails-admin-placeholder__icon">
        <Workflow size={40} />
      </div>
      <p className="sails-admin-placeholder__text">
        This is the <strong>Workflow</strong> plugin.
      </p>
      <p className="sails-admin-placeholder__subtitle">
        Design and manage automated workflows across your platform.
      </p>
      <div className="sails-entity-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="sails-entity-item" />
        ))}
      </div>
    </div>
  );
};

export default AdminWorkflowManager;
