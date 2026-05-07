import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, LayoutGrid, Shield, ArrowUp, ArrowDown } from 'lucide-react';
import { ConsoleApp } from '@klao/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import './AdminAppManager.css';


const AdminAppManager: React.FC = () => {
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<ConsoleApp | null>(null);

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

  if (loading) return <div className="klao-admin-loading">Syncing Apps...</div>;

  return (
    <div className="klao-app-manager">
      <div className="klao-app-manager__actions">
        <button 
          className="klao-btn klao-btn--primary"
          onClick={() => setIsEditing({ id: 'new-' + Date.now(), name: '', icon: 'Box', order: apps.length, requiredCapability: null, tenantId: '', menus: [] })}
        >
          <Plus size={18} />
          <span>New Application</span>
        </button>
      </div>

      <div className="klao-app-grid">
        {apps.map(app => (
          <div key={app.id} className="klao-app-card">
            <div className="klao-app-card__icon">
              <DynamicIcon name={app.icon || 'Box'} size={24} />
            </div>
            <div className="klao-app-card__info">
              <h3>{app.name}</h3>
              <p>{app._count?.menus || 0} Menu Items</p>
              {app.requiredCapability && (
                <div className="klao-app-card__capability">
                  <Shield size={12} />
                  <span>{app.requiredCapability}</span>
                </div>
              )}
            </div>
            <div className="klao-app-card__actions">
              <button onClick={() => setIsEditing(app)} title="Edit App"><Edit2 size={16} /></button>
              <button className="delete" title="Delete App"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="klao-modal-overlay">
          <div className="klao-modal">
            <h2>{isEditing.id.startsWith('new-') ? 'Create App' : 'Edit App'}</h2>
            <form onSubmit={handleSave}>
              <div className="klao-form-group">
                <label>App Name</label>
                <input 
                  type="text" 
                  value={isEditing.name} 
                  onChange={e => setIsEditing({...isEditing, name: e.target.value})}
                  required 
                />
              </div>
              <div className="klao-form-row">
                <div className="klao-form-group">
                  <label>Icon Name (Lucide)</label>
                  <input 
                    type="text" 
                    value={isEditing.icon || ''} 
                    onChange={e => setIsEditing({...isEditing, icon: e.target.value})}
                  />
                </div>
                <div className="klao-form-group">
                  <label>Order</label>
                  <input 
                    type="number" 
                    value={isEditing.order} 
                    onChange={e => setIsEditing({...isEditing, order: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="klao-form-group">
                <label>Required Capability (Optional)</label>
                <input 
                  type="text" 
                  value={isEditing.requiredCapability || ''} 
                  onChange={e => setIsEditing({...isEditing, requiredCapability: e.target.value})}
                  placeholder="e.g. system.admin"
                />
              </div>
              <div className="klao-modal__footer">
                <button type="button" className="klao-btn" onClick={() => setIsEditing(null)}>Cancel</button>
                <button type="submit" className="klao-btn klao-btn--primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAppManager;
