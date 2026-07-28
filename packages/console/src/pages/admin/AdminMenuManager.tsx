import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Edit2, Trash2, GripVertical, X
} from 'lucide-react';
import { ConsoleApp, ConsoleMenu } from '@sails/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import IconPicker from '../../components/common/IconPicker';
import { CustomSelect } from '../../components/common/CustomSelect';
import './AdminMenuManager.css';


const AdminMenuManager: React.FC = () => {
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [menus, setMenus] = useState<ConsoleMenu[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<ConsoleMenu | null>(null);

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    if (selectedAppId) fetchMenus(selectedAppId);
  }, [selectedAppId]);

  const fetchApps = async () => {
    const res = await fetch('/api/console/apps');
    const result = await res.json();
    if (result.success && result.data.length > 0) {
      setApps(result.data);
      setSelectedAppId(result.data[0].id);
    }
  };

  const fetchMenus = async (appId: string) => {
    setLoading(true);
    const res = await fetch(`/api/console/menus?appId=${appId}`);
    const result = await res.json();
    if (result.success) {
      // Build tree structure
      const menuMap: Record<string, ConsoleMenu> = {};
      const roots: ConsoleMenu[] = [];
      
      result.data.forEach((m: ConsoleMenu) => {
        menuMap[m.id] = { ...m, children: [] };
      });

      result.data.forEach((m: ConsoleMenu) => {
        if (m.parentId && menuMap[m.parentId]) {
          menuMap[m.parentId].children?.push(menuMap[m.id]);
        } else {
          roots.push(menuMap[m.id]);
        }
      });
      setMenus(roots);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    setSaving(true);
    const method = isEditing.id.startsWith('new-') ? 'POST' : 'PATCH';
    const isNew = isEditing.id.startsWith('new-');
    const { children, ...cleanData } = isEditing as any;
    const payload = { 
      ...cleanData, 
      appId: selectedAppId,
      id: isNew ? undefined : isEditing.id 
    };

    try {
      const res = await fetch('/api/console/menus', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (result.success) {
        setIsEditing(null);
        fetchMenus(selectedAppId);
      } else {
        alert(result.error || 'Failed to save menu item');
      }
    } catch (err) {
      alert('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (menu: ConsoleMenu) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const message = hasChildren
      ? `Delete "${menu.label}" and all its sub-menus? This cannot be undone.`
      : `Delete "${menu.label}"? This cannot be undone.`;

    if (!window.confirm(message)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/console/menus?id=${menu.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        fetchMenus(selectedAppId);
      } else {
        alert(result.error || 'Failed to delete menu item');
      }
    } catch (err) {
      alert('Network error while deleting');
    } finally {
      setSaving(false);
    }
  };

  const renderMenuItem = (menu: ConsoleMenu, depth = 0) => (
    <React.Fragment key={menu.id}>
      <div className="sails-menu-item" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="sails-menu-item__handle"><GripVertical size={16} /></div>
        <div className="sails-menu-item__icon">
          <DynamicIcon name={menu.icon || 'Circle'} size={16} />
        </div>
        <div className="sails-menu-item__info">
          <span className="label">{menu.label}</span>
          <span className="path">{menu.path || 'No Path'}</span>
          <span className={`badge badge--${menu.actionType}`}>{menu.actionType}</span>
          {menu.isSystem && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.15)', color: 'var(--sails-primary, #3b82f6)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, marginLeft: '6px' }}>
              System
            </span>
          )}
        </div>
        <div className="sails-menu-item__actions">
          <button onClick={() => setIsEditing({...menu})} title="Edit Menu"><Edit2 size={14} /></button>
          <button onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: menu.id, order: 0 } as any)} title="Add Submenu"><Plus size={14} /></button>
          {!menu.isSystem && <button className="delete" onClick={() => handleDelete(menu)} title="Delete Menu"><Trash2 size={14} /></button>}
        </div>
      </div>
      {menu.children?.map(child => renderMenuItem(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="sails-menu-manager">
      <div className="sails-menu-manager__header">
        <div className="sails-app-selector">
          <label className="sails-label" style={{ marginRight: '10px' }}>Selected Application:</label>
          <CustomSelect
            value={selectedAppId}
            options={apps.map(app => ({ value: app.id, label: app.name }))}
            onChange={val => setSelectedAppId(String(val))}
            style={{ minWidth: '220px' }}
          />
        </div>
        <button 
          className="sails-btn sails-btn--primary"
          onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: null, order: menus.length } as any)}
        >
          <Plus size={18} />
          <span>Add Root Menu</span>
        </button>
      </div>

      <div className="sails-menu-tree">
        {loading ? <div className="sails-admin-loading">Loading Menu Structure...</div> : menus.map(m => renderMenuItem(m))}
      </div>

      {isEditing && createPortal(
        <div className="sails-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="sails-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {isEditing.id.startsWith('new-') ? 'New Menu Item' : 'Edit Menu Item'}
              </h3>
              <button onClick={() => setIsEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Label</label>
                <input 
                  type="text" 
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditing.label} 
                  onChange={e => setIsEditing({...isEditing, label: e.target.value})} 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Icon</label>
                  <IconPicker
                    value={isEditing.icon || ''}
                    onChange={val => setIsEditing({...isEditing, icon: val})}
                  />
                </div>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Action Type</label>
                  <CustomSelect
                    value={isEditing.actionType}
                    options={[
                      { value: 'table', label: 'Data Table' },
                      { value: 'plugin', label: 'Custom Plugin' }
                    ]}
                    onChange={val => setIsEditing({ ...isEditing, actionType: String(val) })}
                  />
                </div>
              </div>
              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Browser Path</label>
                <input 
                  type="text" 
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditing.path || ''} 
                  onChange={e => setIsEditing({...isEditing, path: e.target.value})} 
                  placeholder="/crm/leads" 
                />
              </div>
              {isEditing.actionType === 'plugin' && (
                <div className="sails-form-group" style={{ marginBottom: '20px' }}>
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Component Key (Registry)</label>
                  <input 
                    type="text" 
                    className="sails-input"
                    style={{ width: '100%' }}
                    value={isEditing.componentKey || ''} 
                    onChange={e => setIsEditing({...isEditing, componentKey: e.target.value})} 
                    placeholder="AdminUserManager" 
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="sails-btn sails-btn--secondary" onClick={() => setIsEditing(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="sails-btn sails-btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminMenuManager;
