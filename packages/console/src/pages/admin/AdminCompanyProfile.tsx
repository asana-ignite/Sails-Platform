import React from 'react';

const AdminCompanyProfile: React.FC = () => {
  return (
    <div className="klao-card" style={{ textAlign: 'center', borderStyle: 'dashed', background: 'rgba(255,255,255,0.4)' }}>
      <p style={{ color: 'var(--klao-text-muted)' }}>
        This is the <strong>Company Profile</strong> plugin. 
      </p>
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--klao-radius-md)', border: '1px solid var(--klao-border-color)' }} />
        ))}
      </div>
    </div>
  );
};

export default AdminCompanyProfile;
