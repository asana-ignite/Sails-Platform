import React from 'react';

const AdminByocModules: React.FC = () => {
  return (
    <div className="klao-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--klao-text-muted)' }}>
        This is the <strong>Custom Modules (BYOC)</strong> dashboard. 
      </p>
      <div style={{ marginTop: '20px', height: '150px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--klao-radius-md)', border: '1px solid var(--klao-border-color)' }} />
    </div>
  );
};

export default AdminByocModules;
