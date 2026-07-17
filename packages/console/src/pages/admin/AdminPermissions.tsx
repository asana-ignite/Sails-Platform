import React, { useState, useEffect } from 'react';
import './AdminPermissions.css';

interface PermissionDefinition {
  label: string;
  description: string;
  category: string;
}

const AdminPermissions: React.FC = () => {
  const [registry, setRegistry] = useState<Record<string, PermissionDefinition>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from /api/console/permissions
    // For now, we simulate the fetch
    const fetchRegistry = async () => {
      try {
        const response = await fetch('/api/console/permissions');
        const result = await response.json();
        if (result.success) {
          setRegistry(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch permissions registry:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegistry();
  }, []);

  if (loading) return <div className="klao-admin-loading">Loading Registry...</div>;

  const categories = Array.from(new Set(Object.values(registry).map(p => p.category)));

  return (
    <div className="klao-admin-content">
      {categories.map(cat => (
        <section key={cat} className="klao-permission-group">
          <h3 className="klao-permission-category">{cat}</h3>
          <div className="klao-permission-grid">
            {Object.entries(registry)
              .filter(([_, def]) => def.category === cat)
              .map(([key, def]) => (
                <div key={key} className="klao-permission-card">
                  <div className="klao-permission-info">
                    <label className="klao-permission-label">{def.label}</label>
                    <p className="klao-permission-desc">{def.description}</p>
                  </div>
                  <div className="klao-permission-toggle">
                    <input type="checkbox" id={key} />
                    <label htmlFor={key} className="klao-switch"></label>
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
