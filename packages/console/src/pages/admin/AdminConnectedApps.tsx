import React from 'react';

const AdminConnectedApps: React.FC = () => {
  return (
    <div className="sails-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--sails-text-muted)' }}>
        This is the <strong>Connected Apps</strong> configuration. 
      </p>
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '80px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--sails-radius-md)', border: '1px solid var(--sails-border-color)' }} />
        ))}
      </div>
    </div>
  );
};

export default AdminConnectedApps;
