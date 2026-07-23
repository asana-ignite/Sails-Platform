import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
  Database, Layers, Move, GripVertical 
} from 'lucide-react';
import { ConsoleApp, ConsoleMenu } from '@klao/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import { CustomSelect } from '../../components/common/CustomSelect';
import './AdminMenuManager.css';


const AdminMenuManager: React.FC = () => {
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [menus, setMenus] = useState<ConsoleMenu[]>([]);
  const [loading, setLoading] = useState(false);
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

    const method = isEditing.id.startsWith('new-') ? 'POST' : 'PATCH';
    const payload = { 
      ...isEditing, 
      appId: selectedAppId,
      id: isEditing.id.startsWith('new-') ? undefined : isEditing.id 
    };

    const res = await fetch('/api/console/menus', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if ((await res.json()).success) {
      setIsEditing(null);
      fetchMenus(selectedAppId);
    }
  };

  const renderMenuItem = (menu: ConsoleMenu, depth = 0) => (
    <React.Fragment key={menu.id}>
      <div className="klao-menu-item" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="klao-menu-item__handle"><GripVertical size={16} /></div>
        <div className="klao-menu-item__icon">
          <DynamicIcon name={menu.icon || 'Circle'} size={16} />
        </div>
        <div className="klao-menu-item__info">
          <span className="label">{menu.label}</span>
          <span className="path">{menu.path || 'No Path'}</span>
          <span className={`badge badge--${menu.actionType}`}>{menu.actionType}</span>
          {menu.isSystem && (
            <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.15)', color: 'var(--klao-primary, #3b82f6)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, marginLeft: '6px' }}>
              System
            </span>
          )}
        </div>
        <div className="klao-menu-item__actions">
          <button onClick={() => setIsEditing({...menu})} title="Edit Menu"><Edit2 size={14} /></button>
          <button onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: menu.id, order: 0 } as any)} title="Add Submenu"><Plus size={14} /></button>
          {!menu.isSystem && <button className="delete" title="Delete Menu"><Trash2 size={14} /></button>}
        </div>
      </div>
      {menu.children?.map(child => renderMenuItem(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="klao-menu-manager">
      <div className="klao-menu-manager__header">
        <div className="klao-app-selector">
          <label className="klao-label" style={{ marginRight: '10px' }}>Selected Application:</label>
          <CustomSelect
            value={selectedAppId}
            options={apps.map(app => ({ value: app.id, label: app.name }))}
            onChange={val => setSelectedAppId(String(val))}
            style={{ minWidth: '220px' }}
          />
        </div>
        <button 
          className="klao-btn klao-btn--primary"
          onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: null, order: menus.length } as any)}
        >
          <Plus size={18} />
          <span>Add Root Menu</span>
        </button>
      </div>

      <div className="klao-menu-tree">
        {loading ? <div className="klao-admin-loading">Loading Menu Structure...</div> : menus.map(m => renderMenuItem(m))}
      </div>

      {isEditing && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {isEditing.id.startsWith('new-') ? 'New Menu Item' : 'Edit Menu Item'}
              </h3>
              <button onClick={() => setIsEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--klao-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="klao-form-group" style={{ marginBottom: '16px' }}>
                <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Label</label>
                <input 
                  type="text" 
                  className="klao-input"
                  style={{ width: '100%' }}
                  value={isEditing.label} 
                  onChange={e => setIsEditing({...isEditing, label: e.target.value})} 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="klao-form-group">
                  <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Icon</label>
                  <input 
                    type="text" 
                    className="klao-input"
                    style={{ width: '100%' }}
                    value={isEditing.icon || ''} 
                    onChange={e => setIsEditing({...isEditing, icon: e.target.value})} 
                  />
                </div>
                <div className="klao-form-group">
                  <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Action Type</label>
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
              <div className="klao-form-group" style={{ marginBottom: '16px' }}>
                <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Browser Path</label>
                <input 
                  type="text" 
                  className="klao-input"
                  style={{ width: '100%' }}
                  value={isEditing.path || ''} 
                  onChange={e => setIsEditing({...isEditing, path: e.target.value})} 
                  placeholder="/crm/leads" 
                />
              </div>
              {isEditing.actionType === 'plugin' && (
                <div className="klao-form-group" style={{ marginBottom: '20px' }}>
                  <label className="klao-label" style={{ display: 'block', marginBottom: '6px' }}>Component Key (Registry)</label>
                  <input 
                    type="text" 
                    className="klao-input"
                    style={{ width: '100%' }}
                    value={isEditing.componentKey || ''} 
                    onChange={e => setIsEditing({...isEditing, componentKey: e.target.value})} 
                    placeholder="AdminUserManager" 
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="klao-btn klao-btn--secondary" onClick={() => setIsEditing(null)}>Cancel</button>
                <button type="submit" className="klao-btn klao-btn--primary">Save Menu</button>
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
