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

  if (loading) return <div className="inidos-admin-loading">Loading Registry...</div>;

  const categories = Array.from(new Set(Object.values(registry).map(p => p.category)));

  return (
    <div className="inidos-admin-content">
      {categories.map(cat => (
        <section key={cat} className="inidos-permission-group">
          <h3 className="inidos-permission-category">{cat}</h3>
          <div className="inidos-permission-grid">
            {Object.entries(registry)
              .filter(([_, def]) => def.category === cat)
              .map(([key, def]) => (
                <div key={key} className="inidos-permission-card">
                  <div className="inidos-permission-info">
                    <label className="inidos-permission-label">{def.label}</label>
                    <p className="inidos-permission-desc">{def.description}</p>
                  </div>
                  <div className="inidos-permission-toggle">
                    <input type="checkbox" id={key} />
                    <label htmlFor={key} className="inidos-switch"></label>
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
