import React from 'react';

const AdminTestPlugin: React.FC = () => {
  return (
    <div style={{ padding: '40px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid var(--inidos-border-color)' }}>
      <h2>🚀 Test Plugin Active</h2>
      <p>This component was loaded dynamically via the AdminPluginRegistry.</p>
    </div>
  );
};

export default AdminTestPlugin;
