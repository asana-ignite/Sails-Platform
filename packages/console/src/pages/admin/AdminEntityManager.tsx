import React from 'react';
import { Database } from 'lucide-react';

const AdminEntityManager: React.FC = () => {
  return (
    <div className="klao-admin-placeholder">
      <div className="klao-admin-placeholder__icon">
        <Database size={40} />
      </div>
      <p className="klao-admin-placeholder__text">
        This is the <strong>Data Model</strong> plugin (Schema Manager). 
      </p>
      <div className="klao-entity-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="klao-entity-item" />
        ))}
      </div>
    </div>
  );
};

export default AdminEntityManager;
