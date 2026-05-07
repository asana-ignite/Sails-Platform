import React from 'react';
import { useLocation } from 'react-router-dom';

const AdminPlaceholder: React.FC = () => {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionName = pathParts[pathParts.length - 1] || 'Settings';
  
  const formattedName = sectionName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div style={{ padding: '60px', textAlign: 'center', animation: 'klao-fade-in 0.5s ease-out' }}>
      <div style={{ 
        display: 'inline-block', 
        padding: '20px 40px', 
        background: 'rgba(255,255,255,0.8)', 
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--klao-border-color)',
        borderRadius: 'var(--klao-radius-lg)',
        boxShadow: 'var(--klao-shadow-lg)'
      }}>
        <h1 style={{ marginBottom: '10px', color: 'var(--klao-text-main)' }}>{formattedName}</h1>
        <p style={{ color: 'var(--klao-text-muted)' }}>
          This administrative module is part of the <strong>Phase 6 Roadmap</strong>.
          <br />
          Currently connected to the <code>{location.pathname}</code> endpoint.
        </p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
