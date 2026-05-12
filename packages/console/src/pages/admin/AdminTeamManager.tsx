import React from 'react';

const AdminTeamManager: React.FC = () => {
  return (
    <div className="inidos-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--inidos-text-muted)' }}>
        This is the <strong>Team Management</strong> plugin. 
      </p>
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--inidos-radius-md)', border: '1px solid var(--inidos-border-color)' }} />
        ))}
      </div>
    </div>
  );
};

export default AdminTeamManager;
