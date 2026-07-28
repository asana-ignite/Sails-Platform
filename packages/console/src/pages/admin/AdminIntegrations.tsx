import React from 'react';

const AdminIntegrations: React.FC = () => {
  return (
    <div className="sails-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--sails-text-muted)' }}>
        This is the <strong>API & Webhooks</strong> integration manager. 
      </p>
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '40px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--sails-radius-md)', border: '1px solid var(--sails-border-color)' }} />
        ))}
      </div>
    </div>
  );
};

export default AdminIntegrations;
