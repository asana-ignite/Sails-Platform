import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, LayoutGrid, Shield, X, Eye, EyeOff } from 'lucide-react';
import { ConsoleApp } from '@klao/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import './AdminAppManager.css';

const AdminAppManager: React.FC = () => {
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<ConsoleApp | null>(null);
  const [showSystemApps, setShowSystemApps] = useState(false);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/console/apps');
      const result = await response.json();
      if (result.success) {
        setApps(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    const method = isEditing.id.startsWith('new-') ? 'POST' : 'PATCH';
    const payload = isEditing.id.startsWith('new-') ? { ...isEditing, id: undefined } : isEditing;

    try {
      const response = await fetch('/api/console/apps', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditing(null);
        fetchApps();
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      const response = await fetch(`/api/console/apps/${appId}`, { method: 'DELETE' });
      if (response.ok) fetchApps();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) return <div className="klao-admin-loading">Syncing Apps...</div>;

  const visibleApps = apps.filter(app => showSystemApps || !app.isSystem);

  return (
    <div className="klao-app-manager">
      <div className="klao-app-manager__actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          className="klao-btn klao-btn--secondary"
          onClick={() => setShowSystemApps(!showSystemApps)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          {showSystemApps ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{showSystemApps ? 'Hide System Apps' : 'Show System Apps'}</span>
        </button>

        <button 
          className="klao-btn klao-btn--primary"
          onClick={() => setIsEditing({ id: 'new-' + Date.now(), name: '', icon: 'Box', order: apps.length, requiredCapability: null, tenantId: '', menus: [] })}
        >
          <Plus size={18} />
          <span>New Application</span>
        </button>
      </div>

      <div className="klao-app-grid">
        {visibleApps.map(app => (
          <div key={app.id} className="klao-app-card">
            <div className="klao-app-card__icon">
              <DynamicIcon name={app.icon || 'Box'} size={24} />
            </div>
            <div className="klao-app-card__info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>{app.name}</h3>
                {app.isSystem && (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.15)', color: 'var(--klao-primary, #3b82f6)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={10} /> System Protected
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--klao-text-muted)' }}>{app._count?.menus || 0} Menu Items</p>
              {app.requiredCapability && (
                <div className="klao-app-card__capability" style={{ marginTop: '6px' }}>
                  <Shield size={12} />
                  <span>{app.requiredCapability}</span>
                </div>
              )}
            </div>
            <div className="klao-app-card__actions">
              <button onClick={() => setIsEditing(app)} title="Edit App"><Edit2 size={16} /></button>
              {!app.isSystem && (
                <button className="delete" onClick={() => handleDelete(app.id)} title="Delete App"><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isEditing && createPortal(
        <div className="klao-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="klao-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {isEditing.id.startsWith('new-') ? 'Create App' : 'Edit App'}
              </h3>
              <button onClick={() => setIsEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--klao-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="klao-form-group" style={{ marginBottom: '16px' }}>
                <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>App Name</label>
                <input 
                  type="text"
                  className="klao-input"
                  style={{ width: '100%' }}
                  value={isEditing.name} 
                  onChange={e => setIsEditing({...isEditing, name: e.target.value})}
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="klao-form-group">
                  <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Icon (Lucide)</label>
                  <input 
                    type="text"
                    className="klao-input"
                    style={{ width: '100%' }}
                    value={isEditing.icon || ''} 
                    onChange={e => setIsEditing({...isEditing, icon: e.target.value})}
                  />
                </div>
                <div className="klao-form-group">
                  <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Order</label>
                  <input 
                    type="number"
                    className="klao-input"
                    style={{ width: '100%' }}
                    value={isEditing.order} 
                    onChange={e => setIsEditing({...isEditing, order: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="klao-form-group" style={{ marginBottom: '24px' }}>
                <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Required Capability (Optional)</label>
                <input 
                  type="text"
                  className="klao-input"
                  style={{ width: '100%' }}
                  value={isEditing.requiredCapability || ''} 
                  onChange={e => setIsEditing({...isEditing, requiredCapability: e.target.value})}
                  placeholder="e.g. system.users.manage"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="klao-btn klao-btn--secondary" onClick={() => setIsEditing(null)}>Cancel</button>
                <button type="submit" className="klao-btn klao-btn--primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminAppManager;
