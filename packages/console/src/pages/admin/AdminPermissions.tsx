/**
 * AdminPermissions — capability/permission matrix viewer.
 */
import React from 'react';
import { SYSTEM_PERMISSION_REGISTRY } from '@sails/shared';
import './AdminPermissions.css';

const AdminPermissions: React.FC = () => {
  const registry = SYSTEM_PERMISSION_REGISTRY;
  const categories = Array.from(new Set(Object.values(registry).map(p => p.category)));

  return (
    <div className="sails-admin-content">
      {categories.map(cat => (
        <section key={cat} className="sails-permission-group">
          <h3 className="sails-permission-category">{cat}</h3>
          <div className="sails-permission-grid">
            {Object.entries(registry)
              .filter(([_, def]) => def.category === cat)
              .map(([key, def]) => (
                <div key={key} className="sails-permission-card">
                  <div className="sails-permission-info">
                    <label className="sails-permission-label">{def.label}</label>
                    <p className="sails-permission-desc">{def.description}</p>
                  </div>
                  <div className="sails-permission-toggle">
                    <input type="checkbox" id={key} />
                    <label htmlFor={key} className="sails-switch"></label>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AdminPermissions;
