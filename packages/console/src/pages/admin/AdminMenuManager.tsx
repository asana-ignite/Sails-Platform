import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
  Database, Layers, Move, GripVertical 
} from 'lucide-react';
import { ConsoleApp, ConsoleMenu } from '@inidos/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
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
      <div className="inidos-menu-item" style={{ marginLeft: `${depth * 24}px` }}>
        <div className="inidos-menu-item__handle"><GripVertical size={16} /></div>
        <div className="inidos-menu-item__icon">
          <DynamicIcon name={menu.icon || 'Circle'} size={16} />
        </div>
        <div className="inidos-menu-item__info">
          <span className="label">{menu.label}</span>
          <span className="path">{menu.path || 'No Path'}</span>
          <span className={`badge badge--${menu.actionType}`}>{menu.actionType}</span>
        </div>
        <div className="inidos-menu-item__actions">
          <button onClick={() => setIsEditing({...menu})}><Edit2 size={14} /></button>
          <button onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: menu.id, order: 0 } as any)}><Plus size={14} /></button>
          <button className="delete"><Trash2 size={14} /></button>
        </div>
      </div>
      {menu.children?.map(child => renderMenuItem(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="inidos-menu-manager">
      <div className="inidos-menu-manager__header">
        <div className="inidos-app-selector">
          <label>Selected Application:</label>
          <select value={selectedAppId} onChange={e => setSelectedAppId(e.target.value)}>
            {apps.map(app => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </div>
        <button 
          className="inidos-btn inidos-btn--primary"
          onClick={() => setIsEditing({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: null, order: menus.length } as any)}
        >
          <Plus size={18} />
          <span>Add Root Menu</span>
        </button>
      </div>

      <div className="inidos-menu-tree">
        {loading ? <div className="inidos-admin-loading">Loading Menu Structure...</div> : menus.map(m => renderMenuItem(m))}
      </div>

      {isEditing && (
        <div className="inidos-modal-overlay">
          <div className="inidos-modal">
            <h2>{isEditing.id.startsWith('new-') ? 'New Menu Item' : 'Edit Menu Item'}</h2>
            <form onSubmit={handleSave}>
              <div className="inidos-form-group">
                <label>Label</label>
                <input type="text" value={isEditing.label} onChange={e => setIsEditing({...isEditing, label: e.target.value})} required />
              </div>
              <div className="inidos-form-row">
                <div className="inidos-form-group">
                  <label>Icon</label>
                  <input type="text" value={isEditing.icon || ''} onChange={e => setIsEditing({...isEditing, icon: e.target.value})} />
                </div>
                <div className="inidos-form-group">
                  <label>Action Type</label>
                  <select value={isEditing.actionType} onChange={e => setIsEditing({...isEditing, actionType: e.target.value})}>
                    <option value="table">Data Table</option>
                    <option value="plugin">Custom Plugin</option>
                  </select>
                </div>
              </div>
              <div className="inidos-form-group">
                <label>Browser Path</label>
                <input type="text" value={isEditing.path || ''} onChange={e => setIsEditing({...isEditing, path: e.target.value})} placeholder="/crm/leads" />
              </div>
              {isEditing.actionType === 'plugin' && (
                <div className="inidos-form-group">
                  <label>Component Key (Registry)</label>
                  <input type="text" value={isEditing.componentKey || ''} onChange={e => setIsEditing({...isEditing, componentKey: e.target.value})} placeholder="AdminUserManager" />
                </div>
              )}
              <div className="inidos-modal__footer">
                <button type="button" className="inidos-btn" onClick={() => setIsEditing(null)}>Cancel</button>
                <button type="submit" className="inidos-btn inidos-btn--primary">Save Menu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMenuManager;
