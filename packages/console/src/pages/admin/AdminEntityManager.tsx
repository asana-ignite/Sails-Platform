import React from 'react';
import { Database } from 'lucide-react';

const AdminEntityManager: React.FC = () => {
  return (
    <div className="sails-admin-placeholder">
      <div className="sails-admin-placeholder__icon">
        <Database size={40} />
      </div>
      <p className="sails-admin-placeholder__text">
        This is the <strong>Data Model</strong> plugin (Schema Manager). 
      </p>
      <div className="sails-entity-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="sails-entity-item" />
        ))}
      </div>
    </div>
  );
};

export default AdminEntityManager;
