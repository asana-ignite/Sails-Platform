import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Shield, X, Eye, EyeOff, Search, ArrowLeft, GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConsoleApp, ConsoleMenu } from '@sails/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import IconPicker from '../../components/common/IconPicker';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import './AdminAppManager.css';
import './AdminMenuManager.css';

const AdminAppManager: React.FC = () => {
  const { setHeaderActions } = useConsole();
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingApp, setIsEditingApp] = useState<ConsoleApp | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [menus, setMenus] = useState<ConsoleMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingMenu, setIsEditingMenu] = useState<ConsoleMenu | null>(null);

  const [appFilter, setAppFilter] = useState('');
  const [showSystemApps, setShowSystemApps] = useState(false);

  const dragItemRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  const appDragItemRef = useRef<string | null>(null);
  const appDropTargetRef = useRef<string | null>(null);
  const [hasAppOrderChanges, setHasAppOrderChanges] = useState(false);

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    return () => setHeaderActions(null);
  }, []);

  useEffect(() => {
    if (selectedAppId) fetchMenus(selectedAppId);
  }, [selectedAppId]);

  useEffect(() => {
    const app = apps.find(a => a.id === selectedAppId) || null;
    if (app) {
      setHeaderActions(
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasOrderChanges && (
            <button
              className="sails-btn sails-btn--primary"
              onClick={saveOrdering}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Ordering'}
            </button>
          )}
          <button className="sails-btn sails-btn--secondary" onClick={() => setIsEditingApp(app)}><Edit2 size={16} /></button>
          {!app.isSystem && (
            <button className="sails-btn sails-btn--danger" onClick={() => handleDeleteApp(app.id)}><Trash2 size={16} /></button>
          )}
        </div>
      );
    } else {
      setHeaderActions(
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasAppOrderChanges && (
            <button
              className="sails-btn sails-btn--primary"
              onClick={saveAppOrdering}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save App Ordering'}
            </button>
          )}
          <button
            className="sails-btn sails-btn--primary"
            onClick={() => setIsEditingApp({ id: 'new-' + Date.now(), name: '', icon: 'Box', order: apps.length, requiredCapability: null, tenantId: '', menus: [] })}
          >
            <Plus size={18} />
            <span>New App</span>
          </button>
        </div>
      );
    }
  }, [selectedAppId, apps, menus.length, hasOrderChanges, hasAppOrderChanges, saving]);

  const fetchApps = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/console/apps');
      const result = await response.json();
      if (result.success) setApps(result.data);
    } catch (error) {
      console.error('Failed to fetch apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenus = async (appId: string) => {
    setMenusLoading(true);
    const res = await fetch(`/api/console/menus?appId=${appId}`);
    const result = await res.json();
    if (result.success) {
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
    setMenusLoading(false);
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingApp) return;
    const method = isEditingApp.id.startsWith('new-') ? 'POST' : 'PATCH';
    const payload = isEditingApp.id.startsWith('new-') ? { ...isEditingApp, id: undefined } : isEditingApp;
    try {
      const response = await fetch('/api/console/apps', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        setIsEditingApp(null);
        fetchApps();
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (!window.confirm('Delete this app and all its menus? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/console/apps/${appId}`, { method: 'DELETE' });
      if (response.ok) {
        if (selectedAppId === appId) setSelectedAppId(null);
        fetchApps();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleAppDragStart = (e: React.DragEvent, appId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
    appDragItemRef.current = appId;
    (e.currentTarget as HTMLElement).classList.add('sails-app-card--dragging');
  };

  const handleAppDragOver = (e: React.DragEvent, appId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!appDragItemRef.current || appDragItemRef.current === appId) return;

    const target = e.currentTarget as HTMLElement;

    if (appDropTargetRef.current && appDropTargetRef.current !== appId) {
      const prev = document.querySelector(`[data-app-id="${appDropTargetRef.current}"]`);
      if (prev) prev.classList.remove('sails-app-card--drop-target');
    }

    appDropTargetRef.current = appId;
    target.classList.add('sails-app-card--drop-target');
  };

  const handleAppDragLeave = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as Node)) {
      el.classList.remove('sails-app-card--drop-target');
    }
  };

  const handleAppDragEnd = () => {
    document.querySelectorAll('.sails-app-card--dragging, .sails-app-card--drop-target').forEach(el => {
      el.classList.remove('sails-app-card--dragging', 'sails-app-card--drop-target');
    });
    appDragItemRef.current = null;
    appDropTargetRef.current = null;
  };

  const handleAppDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = appDragItemRef.current;
    handleAppDragEnd();
    if (!dragId || dragId === targetId) return;
    reorderApps(dragId, targetId);
  };

  const reorderApps = (fromId: string, toId: string) => {
    const fromIdx = apps.findIndex(a => a.id === fromId);
    const toIdx = apps.findIndex(a => a.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const updated = [...apps];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    setApps(updated);
    setHasAppOrderChanges(true);
  };

  const handleAppMoveUp = (appId: string) => {
    const idx = apps.findIndex(a => a.id === appId);
    if (idx <= 0) return;
    reorderApps(appId, apps[idx - 1].id);
  };

  const handleAppMoveDown = (appId: string) => {
    const idx = apps.findIndex(a => a.id === appId);
    if (idx >= apps.length - 1) return;
    reorderApps(appId, apps[idx + 1].id);
  };

  const saveAppOrdering = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < apps.length; i++) {
        await fetch('/api/console/apps', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: apps[i].id, order: i }),
        });
      }
      setHasAppOrderChanges(false);
      fetchApps();
    } catch (err) {
      alert('Failed to save app ordering');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingMenu) return;
    setSaving(true);
    const method = isEditingMenu.id.startsWith('new-') ? 'POST' : 'PATCH';
    const isNew = isEditingMenu.id.startsWith('new-');
    const { children, ...cleanData } = isEditingMenu as any;
    const payload = {
      ...cleanData,
      appId: selectedAppId,
      id: isNew ? undefined : isEditingMenu.id
    };
    try {
      const res = await fetch('/api/console/menus', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setIsEditingMenu(null);
        if (selectedAppId) fetchMenus(selectedAppId);
      } else {
        alert(result.error || 'Failed to save menu item');
      }
    } catch (err) {
      alert('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenu = async (menu: ConsoleMenu) => {
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
        if (selectedAppId) fetchMenus(selectedAppId);
      } else {
        alert(result.error || 'Failed to delete menu item');
      }
    } catch (err) {
      alert('Network error while deleting');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, menuId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', menuId);
    dragItemRef.current = menuId;
    (e.currentTarget as HTMLElement).classList.add('sails-menu-item--dragging');
  };

  const handleDragOver = (e: React.DragEvent, menuId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragItemRef.current || dragItemRef.current === menuId) return;

    const target = e.currentTarget as HTMLElement;

    if (dropTargetRef.current && dropTargetRef.current !== menuId) {
      const prev = document.querySelector(`[data-menu-id="${dropTargetRef.current}"]`);
      if (prev) prev.classList.remove('sails-menu-item--drop-target');
    }

    dropTargetRef.current = menuId;
    target.classList.add('sails-menu-item--drop-target');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as Node)) {
      el.classList.remove('sails-menu-item--drop-target');
    }
  };

  const handleDragEnd = () => {
    document.querySelectorAll('.sails-menu-item--dragging, .sails-menu-item--drop-target').forEach(el => {
      el.classList.remove('sails-menu-item--dragging', 'sails-menu-item--drop-target');
    });
    dragItemRef.current = null;
    dropTargetRef.current = null;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = dragItemRef.current;
    handleDragEnd();
    if (!dragId || dragId === targetId || !selectedAppId) return;
    reorderItem(dragId, targetId);
  };

  const findMenuWithParent = (
    items: ConsoleMenu[],
    id: string,
    parentId: string | null
  ): { arr: ConsoleMenu[]; idx: number; parentId: string | null } | null => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) return { arr: items, idx: i, parentId };
      if (items[i].children) {
        const found = findMenuWithParent(items[i].children!, id, items[i].id);
        if (found) return found;
      }
    }
    return null;
  };

  const replaceChildren = (
    items: ConsoleMenu[],
    parentId: string,
    replacement: ConsoleMenu[]
  ): ConsoleMenu[] =>
    items.map(m =>
      m.id === parentId
        ? { ...m, children: replacement }
        : m.children ? { ...m, children: replaceChildren(m.children, parentId, replacement) } : m
    );

  const reorderItem = (fromId: string, toId: string) => {
    const from = findMenuWithParent(menus, fromId, null);
    const to = findMenuWithParent(menus, toId, null);
    if (!from || !to || from.parentId !== to.parentId) return;

    const siblings = [...from.arr];
    const [moved] = siblings.splice(from.idx, 1);
    const toPos = siblings.findIndex(m => m.id === toId);
    if (toPos < 0) return;

    siblings.splice(toPos + (from.idx < to.idx ? 1 : 0), 0, moved);

    if (!from.parentId) {
      setMenus(siblings);
    } else {
      setMenus(replaceChildren([...menus], from.parentId, siblings));
    }
    setHasOrderChanges(true);
  };

  const handleMoveUp = (menuId: string) => {
    const info = findMenuWithParent(menus, menuId, null);
    if (!info || info.idx <= 0) return;
    reorderItem(menuId, info.arr[info.idx - 1].id);
  };

  const handleMoveDown = (menuId: string) => {
    const info = findMenuWithParent(menus, menuId, null);
    if (!info || info.idx >= info.arr.length - 1) return;
    reorderItem(menuId, info.arr[info.idx + 1].id);
  };

  const saveOrdering = async () => {
    setSaving(true);
    const flatten = (items: ConsoleMenu[], parentId: string | null): ConsoleMenu[] =>
      items.flatMap((m, i) => [
        { ...m, order: i, parentId },
        ...flatten(m.children || [], m.id)
      ]);

    const ordered = flatten(menus, null);
    try {
      for (const item of ordered) {
        await fetch('/api/console/menus', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, order: item.order })
        });
      }
      setHasOrderChanges(false);
      if (selectedAppId) fetchMenus(selectedAppId);
    } catch (err) {
      alert('Failed to save ordering');
    } finally {
      setSaving(false);
    }
  };

  const renderMenuItem = (menu: ConsoleMenu, depth = 0, idx = 0, siblingCount = 1) => (
    <React.Fragment key={menu.id}>
      <div
        className="sails-menu-item"
        style={{ marginLeft: `${depth * 24}px` }}
        data-menu-id={menu.id}
        draggable
        onDragStart={(e) => handleDragStart(e, menu.id)}
        onDragOver={(e) => handleDragOver(e, menu.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, menu.id)}
        onDragEnd={handleDragEnd}
      >
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
          <button
            onClick={() => handleMoveUp(menu.id)}
            disabled={idx === 0}
            title="Move Up"
            style={idx === 0 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => handleMoveDown(menu.id)}
            disabled={idx >= siblingCount - 1}
            title="Move Down"
            style={idx >= siblingCount - 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
          >
            <ChevronDown size={14} />
          </button>
          <button onClick={() => setIsEditingMenu({...menu})} title="Edit Menu"><Edit2 size={14} /></button>
          <button onClick={() => setIsEditingMenu({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: menu.id, order: 0 } as any)} title="Add Submenu"><Plus size={14} /></button>
          {!menu.isSystem && <button className="delete" onClick={() => handleDeleteMenu(menu)} title="Delete Menu"><Trash2 size={14} /></button>}
        </div>
      </div>
      {menu.children?.map((child, childIdx) => renderMenuItem(child, depth + 1, childIdx, menu.children!.length))}
    </React.Fragment>
  );
  if (loading) return <div className="sails-admin-loading">Syncing Apps v2...</div>;

  const selectedApp = apps.find(a => a.id === selectedAppId) || null;
  const filteredApps = apps.filter(app => {
    if (!showSystemApps && app.isSystem) return false;
    if (appFilter && !app.name.toLowerCase().includes(appFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="sails-app-manager">
      {selectedApp ? (
        <>
          <div className="sails-menu-manager__header" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="sails-btn sails-btn--secondary"
                onClick={() => { setSelectedAppId(null); setMenus([]); setHasOrderChanges(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <ArrowLeft size={16} />
                <span>All Apps</span>
              </button>
              <div className="sails-app-card__icon" style={{ width: 36, height: 36 }}>
                <DynamicIcon name={selectedApp.icon || 'Box'} size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{selectedApp.name}</h3>
                {selectedApp.isSystem && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.15)', color: 'var(--sails-primary, #3b82f6)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    System Protected
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="sails-menu-manager__header" style={{ marginBottom: '16px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Navigation Menus
              {hasOrderChanges && (
                <span style={{ fontSize: '0.75rem', color: 'var(--sails-primary)', fontWeight: 400, marginLeft: '8px' }}>(unsaved)</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {hasOrderChanges && (
                <button className="sails-btn sails-btn--primary" onClick={saveOrdering} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Ordering'}
                </button>
              )}
              <button
                className="sails-btn sails-btn--primary"
                onClick={() => setIsEditingMenu({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'table', parentId: null, order: menus.length } as any)}
              >
                <Plus size={16} />
                <span>Add Root Menu</span>
              </button>
            </div>
          </div>

          <div className="sails-menu-tree">
            {menusLoading ? (
              <div className="sails-admin-loading">Loading Menu Structure...</div>
            ) : menus.length === 0 ? (
              <div className="sails-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--sails-text-muted)' }}>
                No menu items yet. Add your first root menu above.
              </div>
            ) : (
              menus.map((m, i) => renderMenuItem(m, 0, i, menus.length))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="sails-app-manager__actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
                <input
                  type="text"
                  className="sails-input"
                  placeholder="Search apps..."
                  value={appFilter}
                  onChange={e => setAppFilter(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                />
              </div>
              <button
                className="sails-btn sails-btn--secondary"
                onClick={() => setShowSystemApps(!showSystemApps)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                {showSystemApps ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showSystemApps ? 'Hide System' : 'Show System'}</span>
              </button>
            </div>
          </div>

          <div className="sails-app-grid">
            {filteredApps.length === 0 ? (
              <div className="sails-card" style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1', color: 'var(--sails-text-muted)' }}>
                {appFilter ? 'No apps match your search.' : 'No apps to display.'}
              </div>
            ) : (
              filteredApps.map((app) => { const appIdx = apps.findIndex(a => a.id === app.id); return (
                <div
                  key={app.id}
                  className="sails-app-card"
                  data-app-id={app.id}
                  draggable
                  onDragStart={(e) => handleAppDragStart(e, app.id)}
                  onDragOver={(e) => handleAppDragOver(e, app.id)}
                  onDragLeave={handleAppDragLeave}
                  onDrop={(e) => handleAppDrop(e, app.id)}
                  onDragEnd={handleAppDragEnd}
                >
                  <div className="sails-app-card__top">
                    <div
                      className="sails-app-card__drag-handle"
                      onClick={e => e.stopPropagation()}
                    >
                      <GripVertical size={16} />
                    </div>
                    <div className="sails-app-card__icon">
                      <DynamicIcon name={app.icon || 'Box'} size={24} />
                      {app.isSystem && (
                        <span className="sails-app-card__system-badge">
                          <Shield size={10} />
                        </span>
                      )}
                    </div>
                    <div className="sails-app-card__info" onClick={() => setSelectedAppId(app.id)} style={{ cursor: 'pointer' }}>
                      <h3 style={{ margin: 0 }}>{app.name}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>{app._count?.menus || 0} Menu Items</p>
                      <div className={`sails-app-card__capability${app.requiredCapability ? ' sails-app-card__capability--active' : ''}`}>
                        {app.requiredCapability && (
                          <>
                            <Shield size={12} />
                            <span>{app.requiredCapability}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="sails-app-card__actions" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleAppMoveUp(app.id)}
                      disabled={appIdx === 0}
                      title="Move Left"
                      style={appIdx === 0 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => handleAppMoveDown(app.id)}
                      disabled={appIdx >= apps.length - 1}
                      title="Move Right"
                      style={appIdx >= apps.length - 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setIsEditingApp(app)} title="Edit App"><Edit2 size={16} /></button>
                    {!app.isSystem && (
                      <button className="delete" onClick={() => handleDeleteApp(app.id)} title="Delete App"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ) })
            )}
          </div>
        </>
      )}

      {isEditingApp && createPortal(
        <div className="sails-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="sails-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {isEditingApp.id.startsWith('new-') ? 'Create App' : 'Edit App'}
              </h3>
              <button onClick={() => setIsEditingApp(null)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveApp}>
              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>App Name</label>
                <input
                  type="text"
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditingApp.name}
                  onChange={e => setIsEditingApp({...isEditingApp, name: e.target.value})}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Icon</label>
                  <IconPicker
                    value={isEditingApp.icon || ''}
                    onChange={val => setIsEditingApp({...isEditingApp, icon: val})}
                  />
                </div>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Order</label>
                  <input
                    type="number"
                    className="sails-input"
                    style={{ width: '100%' }}
                    value={isEditingApp.order}
                    onChange={e => setIsEditingApp({...isEditingApp, order: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="sails-form-group" style={{ marginBottom: '24px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Required Capability (Optional)</label>
                <input
                  type="text"
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditingApp.requiredCapability || ''}
                  onChange={e => setIsEditingApp({...isEditingApp, requiredCapability: e.target.value})}
                  placeholder="e.g. system.users.manage"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="sails-btn sails-btn--secondary" onClick={() => setIsEditingApp(null)}>Cancel</button>
                <button type="submit" className="sails-btn sails-btn--primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isEditingMenu && createPortal(
        <div className="sails-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="sails-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {isEditingMenu.id.startsWith('new-') ? 'New Menu Item' : 'Edit Menu Item'}
              </h3>
              <button onClick={() => setIsEditingMenu(null)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveMenu}>
              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Label</label>
                <input
                  type="text"
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditingMenu.label}
                  onChange={e => setIsEditingMenu({...isEditingMenu, label: e.target.value})}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Icon</label>
                  <IconPicker
                    value={isEditingMenu.icon || ''}
                    onChange={val => setIsEditingMenu({...isEditingMenu, icon: val})}
                  />
                </div>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Action Type</label>
                  <CustomSelect
                    value={isEditingMenu.actionType}
                    options={[
                      { value: 'table', label: 'Data Table' },
                      { value: 'plugin', label: 'Custom Plugin' }
                    ]}
                    onChange={val => setIsEditingMenu({ ...isEditingMenu, actionType: String(val) })}
                  />
                </div>
              </div>
              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Browser Path</label>
                <input
                  type="text"
                  className="sails-input"
                  style={{ width: '100%' }}
                  value={isEditingMenu.path || ''}
                  onChange={e => setIsEditingMenu({...isEditingMenu, path: e.target.value})}
                  placeholder="/crm/leads"
                />
              </div>
              {isEditingMenu.actionType === 'plugin' && (
                <div className="sails-form-group" style={{ marginBottom: '20px' }}>
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Component Key (Registry)</label>
                  <input
                    type="text"
                    className="sails-input"
                    style={{ width: '100%' }}
                    value={isEditingMenu.componentKey || ''}
                    onChange={e => setIsEditingMenu({...isEditingMenu, componentKey: e.target.value})}
                    placeholder="AdminUserManager"
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="sails-btn sails-btn--secondary" onClick={() => setIsEditingMenu(null)} disabled={saving}>Cancel</button>
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

export default AdminAppManager;
