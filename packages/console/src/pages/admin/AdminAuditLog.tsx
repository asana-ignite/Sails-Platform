import React from 'react';

const AdminAuditLog: React.FC = () => {
  return (
    <div className="klao-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--klao-text-muted)' }}>
        This is the <strong>Audit History</strong> viewer. 
      </p>
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '30px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--klao-radius-sm)', border: '1px solid var(--klao-border-color)' }} />
        ))}
      </div>
    </div>
  );
};

export default AdminAuditLog;
