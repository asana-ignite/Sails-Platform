import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Edit2, Trash2, Shield, X, Eye, EyeOff, Search,
  ArrowLeft, GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  AlertCircle, Save, Lock
} from 'lucide-react';
import { ConsoleApp, ConsoleMenu, SailsTableDefinition, TableLayout, toSnakeCase } from '@sails/shared';
import DynamicIcon from '../../components/common/DynamicIcon';
import IconPicker from '../../components/common/IconPicker';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import { fetchCached } from '../../api/client';
import WidgetsTab from './WidgetsTab';
import './AdminAppManager.css';
import './AdminMenuManager.css';

type DetailTab = 'general' | 'navigation' | 'widget' | 'permission';

const EMPTY_MENU: ConsoleMenu = { id: '', label: '', icon: 'Circle', path: '', actionType: 'data_model', order: 0 };

const AdminAppManager: React.FC = () => {
  const { setHeaderActions } = useConsole();
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmAppId, setDeleteConfirmAppId] = useState<string | null>(null);

  const [appFilter, setAppFilter] = useState('');
  const [showSystemApps, setShowSystemApps] = useState(false);

  const appDragItemRef = useRef<string | null>(null);
  const appDropTargetRef = useRef<string | null>(null);
  const [hasAppOrderChanges, setHasAppOrderChanges] = useState(false);

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

  useEffect(() => { fetchApps(); }, []);
  useEffect(() => { return () => setHeaderActions(null); }, []);

  useEffect(() => {
    if (selectedAppId) {
      setHeaderActions(null);
    } else {
      setHeaderActions(
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasAppOrderChanges && (
            <button className="sails-btn sails-btn--primary" onClick={saveAppOrdering} disabled={saving}>
              {saving ? 'Saving...' : 'Save Ordering'}
            </button>
          )}
          <button className="sails-btn sails-btn--primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>New App</span>
          </button>
        </div>
      );
    }
  }, [selectedAppId, hasAppOrderChanges, saving]);

  const handleDeleteApp = async (appId: string) => {
    setDeleteConfirmAppId(appId);
  };

  const confirmDeleteApp = async () => {
    if (!deleteConfirmAppId) return;
    try {
      const response = await fetch(`/api/console/apps/${deleteConfirmAppId}`, { method: 'DELETE' });
      if (response.ok) {
        if (selectedAppId === deleteConfirmAppId) setSelectedAppId(null);
        setDeleteConfirmAppId(null);
        fetchApps();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
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
    if (!el.contains(e.relatedTarget as Node)) el.classList.remove('sails-app-card--drop-target');
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

  if (loading) return <div className="sails-admin-loading">Syncing Apps...</div>;

  const selectedApp = apps.find(a => a.id === selectedAppId) || null;
  const filteredApps = apps.filter(app => {
    if (!showSystemApps && app.isSystem) return false;
    if (appFilter && !app.name.toLowerCase().includes(appFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="sails-app-manager">
      {selectedApp ? (
        <AppDetailView
          app={selectedApp}
          onBack={() => { setSelectedAppId(null); fetchApps(); }}
          onDelete={handleDeleteApp}
          onRefresh={fetchApps}
        />
      ) : (
        <>
          <div className="sails-app-manager__actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
                <input type="text" className="sails-input" placeholder="Search apps..." value={appFilter}
                  onChange={e => setAppFilter(e.target.value)} style={{ paddingLeft: '36px' }} />
              </div>
              <button className="sails-btn sails-btn--secondary" onClick={() => setShowSystemApps(!showSystemApps)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
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
              filteredApps.map((app) => {
                const appIdx = apps.findIndex(a => a.id === app.id);
                return (
                  <div key={app.id} className="sails-app-card" data-app-id={app.id} draggable
                    onDragStart={(e) => handleAppDragStart(e, app.id)}
                    onDragOver={(e) => handleAppDragOver(e, app.id)}
                    onDragLeave={handleAppDragLeave}
                    onDrop={(e) => handleAppDrop(e, app.id)}
                    onDragEnd={handleAppDragEnd}>
                    <div className="sails-app-card__top">
                      <div className="sails-app-card__drag-handle" onClick={e => e.stopPropagation()}>
                        <GripVertical size={16} />
                      </div>
                      <div className="sails-app-card__icon">
                        <DynamicIcon name={app.icon || 'Box'} size={24} />
                        {app.isSystem && <span className="sails-app-card__system-badge"><Shield size={10} /></span>}
                      </div>
                      <div className="sails-app-card__info" onClick={() => setSelectedAppId(app.id)} style={{ cursor: 'pointer' }}>
                        <h3 style={{ margin: 0 }}>{app.name}</h3>
                        {app.description && <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>{app.description}</p>}
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>{app._count?.menus || 0} Menu Items</p>
                        {app.requiredCapability && (
                          <div className="sails-app-card__capability sails-app-card__capability--active">
                            <Shield size={12} />
                            <span>{app.requiredCapability}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sails-app-card__actions" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleAppMoveUp(app.id)} disabled={appIdx === 0}
                        title="Move Left" style={appIdx === 0 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
                        <ChevronLeft size={14} />
                      </button>
                      <button onClick={() => handleAppMoveDown(app.id)} disabled={appIdx >= apps.length - 1}
                        title="Move Right" style={appIdx >= apps.length - 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
                        <ChevronRight size={14} />
                      </button>
                      {!app.isSystem && <button className="delete" onClick={() => handleDeleteApp(app.id)} title="Delete App"><Trash2 size={16} /></button>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateAppModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchApps(); }}
        />
      )}

      {deleteConfirmAppId && createPortal(
        <div className="sails-app-overlay">
          <div className="sails-app-confirm-dialog">
            <div className="sails-app-confirm-dialog__header">
              <Trash2 size={22} style={{ color: 'var(--sails-danger)' }} />
              <span>Delete App</span>
            </div>
            <div className="sails-app-confirm-dialog__body">
              This will permanently delete <strong>"{apps.find(a => a.id === deleteConfirmAppId)?.name}"</strong> and all its menus. This action cannot be undone.
            </div>
            <div className="sails-app-confirm-dialog__footer">
              <button className="sails-btn sails-btn--ghost" onClick={() => setDeleteConfirmAppId(null)}>Cancel</button>
              <button className="sails-btn sails-app-confirm-dialog__btn-danger" onClick={confirmDeleteApp}>Delete App</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const CreateAppModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Box');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/console/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: toSnakeCase(slug || name), description: description || undefined, icon }),
      });
      const result = await res.json();
      if (result.success) {
        onCreated();
      } else {
        alert(result.error || 'Failed to create app');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="sails-app-overlay">
      <div className="sails-app-create-dialog">
        <div className="sails-app-create-dialog__header">
          <div className="sails-app-create-dialog__header-info">
            <div className="sails-app-create-dialog__header-icon">
              <DynamicIcon name="LayoutGrid" size={22} />
            </div>
            <div>
              <h3>Create New App</h3>
              <p>Configure your application settings</p>
            </div>
          </div>
          <button className="sails-app-create-dialog__close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="sails-app-create-dialog__body">
          <div className="sails-app-form-grid">
            <div className="sails-app-field-group">
              <label className="sails-app-field-label">App Name <span className="sails-app-required">*</span></label>
              <input type="text" className="sails-input" value={name} onChange={e => {
                const val = e.target.value;
                setName(val);
                setSlug(toSnakeCase(val));
              }}
                placeholder="e.g. Customer Portal" required />
              <span className="sails-app-field-hint">Display name shown in the app switcher.</span>
            </div>
            <div className="sails-app-field-group">
              <label className="sails-app-field-label">System Name (Slug)</label>
              <input type="text" className="sails-input" value={slug} onChange={e => setSlug(e.target.value)}
                placeholder="e.g. customer-portal" />
              <span className="sails-app-field-hint">Unique URL-safe identifier. Leave blank to auto-generate.</span>
            </div>
          </div>
          <div className="sails-app-field-group sails-app-field-group--full">
            <label className="sails-app-field-label">Description</label>
            <textarea className="sails-input sails-input--textarea" value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe the purpose of this app..."
              rows={5} />
          </div>
          <div className="sails-app-field-group">
            <label className="sails-app-field-label">Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div className="sails-app-create-dialog__footer">
            <button type="button" className="sails-btn sails-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="sails-btn sails-btn--primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create App'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const AppDetailView: React.FC<{
  app: ConsoleApp;
  onBack: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}> = ({ app, onBack, onDelete, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('general');
  const [pendingTabSwitch, setPendingTabSwitch] = useState<DetailTab | null>(null);

  const [name, setName] = useState(app.name);
  const [slug, setSlug] = useState(app.slug || '');
  const [description, setDescription] = useState(app.description || '');
  const [icon, setIcon] = useState(app.icon || 'Box');
  const [isSavingTab, setIsSavingTab] = useState(false);

  const [savedGeneral, setSavedGeneral] = useState({
    name: app.name,
    slug: app.slug || '',
    description: app.description || '',
    icon: app.icon || 'Box',
  });

  const isGeneralDirty =
    name !== savedGeneral.name ||
    slug !== savedGeneral.slug ||
    description !== savedGeneral.description ||
    icon !== savedGeneral.icon;

  const isCurrentTabDirty = (tab?: DetailTab) => {
    const t = tab || activeTab;
    if (t === 'general') return isGeneralDirty;
    return false;
  };

  const handleTabClick = (targetTab: DetailTab) => {
    if (targetTab === activeTab) return;
    if (isCurrentTabDirty()) {
      setPendingTabSwitch(targetTab);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleDiscardAndSwitch = () => {
    setName(savedGeneral.name);
    setSlug(savedGeneral.slug);
    setDescription(savedGeneral.description);
    setIcon(savedGeneral.icon);
    if (pendingTabSwitch) {
      setActiveTab(pendingTabSwitch);
      setPendingTabSwitch(null);
    }
  };

  const handleSaveAndSwitch = async () => {
    await saveGeneralSettings();
    if (pendingTabSwitch) {
      setActiveTab(pendingTabSwitch);
      setPendingTabSwitch(null);
    }
  };

  const saveGeneralSettings = async () => {
    setIsSavingTab(true);
    try {
      const res = await fetch('/api/console/apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: app.id,
          name,
          slug: toSnakeCase(slug || name),
          description: description || undefined,
          icon,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSavedGeneral({ name, slug, description, icon });
        onRefresh();
      } else {
        alert(result.error || 'Failed to save');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsSavingTab(false);
    }
  };

  return (
    <div className="sails-app-detail">
      <div className="sails-app-detail__header">
        <div className="sails-app-detail__header-left">
          <button className="sails-btn sails-btn--secondary sails-app-detail__back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>All Apps</span>
          </button>
          <div className="sails-app-detail__app-icon">
            <DynamicIcon name={app.icon || 'Box'} size={22} />
          </div>
          <div>
            <h3 className="sails-app-detail__app-name">{app.name}</h3>
            {app.isSystem && <span className="sails-app-detail__system-badge">System Protected</span>}
          </div>
        </div>
        <div className="sails-app-detail__header-actions">
          {!app.isSystem && (
            <button className="sails-btn sails-btn--danger" onClick={() => onDelete(app.id)}>
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      <nav className="sails-app-detail__tabs">
        {(['general', 'navigation', 'widget', 'permission'] as DetailTab[]).map(tab => (
          <button
            key={tab}
            className={`sails-app-detail__tab ${activeTab === tab ? 'sails-app-detail__tab--active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            <span>{tab === 'general' ? 'General Setting' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            {tab === 'general' && isGeneralDirty && <span className="sails-app-detail__dirty-dot" title="Unsaved changes" />}
          </button>
        ))}
      </nav>

      <div className="sails-app-detail__body">
        {activeTab === 'general' && (
          <div className="sails-app-detail__section">
            <div className="sails-app-form-grid">
              <div className="sails-app-field-group">
                <label className="sails-app-field-label">App Name</label>
                <input type="text" className="sails-input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="sails-app-field-group">
                <label className="sails-app-field-label">System Name (Slug)</label>
                <div className="sails-app-field-input-wrapper">
                  <input type="text" className="sails-input sails-app-field-input--locked" value={slug} readOnly disabled />
                  <Lock size={14} className="sails-app-field-lock-icon" />
                </div>
                <span className="sails-app-field-hint">System name cannot be changed after creation.</span>
              </div>
            </div>
            <div className="sails-app-field-group">
              <label className="sails-app-field-label">Description</label>
              <textarea className="sails-input sails-input--textarea" value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the purpose of this app..."
                rows={5} />
            </div>
            <div className="sails-app-field-group">
              <label className="sails-app-field-label">Icon</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="sails-app-detail__save-row">
              <button
                className="sails-btn sails-btn--primary"
                onClick={saveGeneralSettings}
                disabled={!isGeneralDirty || isSavingTab}
              >
                <Save size={16} />
                <span>{isSavingTab ? 'Saving...' : 'Save General Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'navigation' && (
          <NavigationTab appId={app.id} appSlug={slug} onRefresh={onRefresh} />
        )}

        {activeTab === 'widget' && (
          <WidgetsTab appId={app.id} widgetBarEnabled={app.widgetBarEnabled || false} />
        )}

        {activeTab === 'permission' && (
          <div className="sails-app-detail__section sails-app-detail__placeholder">
            <div className="sails-app-detail__placeholder-icon">
              <DynamicIcon name="ShieldCheck" size={48} />
            </div>
            <h4>Permission Settings</h4>
            <p>Role-based access control and capability assignments will be managed here.</p>
            <span className="sails-app-detail__coming-soon">Coming Soon</span>
          </div>
        )}
      </div>

      {pendingTabSwitch && createPortal(
        <div className="sails-app-overlay">
          <div className="sails-app-confirm-dialog">
            <div className="sails-app-confirm-dialog__header">
              <AlertCircle size={22} style={{ color: 'var(--sails-warning)' }} />
              <span>Unsaved Changes</span>
            </div>
            <div className="sails-app-confirm-dialog__body">
              You have unsaved changes in the General Settings tab. If you switch tabs without saving, your modifications will be discarded.
            </div>
            <div className="sails-app-confirm-dialog__footer">
              <button className="sails-btn sails-btn--ghost" onClick={() => setPendingTabSwitch(null)}>Stay on Tab</button>
              <button className="sails-btn sails-app-confirm-dialog__btn-discard" onClick={handleDiscardAndSwitch}>Discard Changes</button>
              <button className="sails-btn sails-btn--primary" onClick={handleSaveAndSwitch}>Save &amp; Switch</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const NavigationTab: React.FC<{ appId: string; appSlug: string; onRefresh: () => void }> = ({ appId, appSlug, onRefresh }) => {
  const [menus, setMenus] = useState<ConsoleMenu[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [isEditingMenu, setIsEditingMenu] = useState<ConsoleMenu | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [deleteConfirmMenu, setDeleteConfirmMenu] = useState<ConsoleMenu | null>(null);
  const [dataModels, setDataModels] = useState<SailsTableDefinition[]>([]);
  const [availableViews, setAvailableViews] = useState<TableLayout[]>([]);

  const dragItemRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);

  useEffect(() => { fetchMenus(); }, [appId]);

  useEffect(() => {
    if (isEditingMenu) fetchDataModels();
  }, [isEditingMenu]);

  useEffect(() => {
    if (isEditingMenu?.dataModelId) {
      setAvailableViews([]);
      fetchAvailableViews(isEditingMenu.dataModelId, isEditingMenu.listViewId);
    } else {
      setAvailableViews([]);
    }
  }, [isEditingMenu?.dataModelId]);

  const fetchMenus = async () => {
    setMenusLoading(true);
    const res = await fetch(`/api/console/menus?appId=${appId}`);
    const result = await res.json();
    if (result.success) {
      const menuMap: Record<string, ConsoleMenu> = {};
      const roots: ConsoleMenu[] = [];
      result.data.forEach((m: ConsoleMenu) => { menuMap[m.id] = { ...m, children: [] }; });
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

  const fetchDataModels = async () => {
    try {
      const data = await fetchCached('/api/metadata/objects', undefined, 60000);
      if (Array.isArray(data)) setDataModels(data);
    } catch (err) {
      console.error('Failed to fetch data models:', err);
    }
  };

  const fetchAvailableViews = async (tableId: string, currentListViewId?: string | null) => {
    try {
      const result = await fetchCached(`/api/console/layouts?tableId=${tableId}&status=active`);
      if (result.success) {
        const views: TableLayout[] = (result.data?.rows || []).filter(
          (r: any) => r.viewType === 'LIST' && r.status === 'active'
        );
        setAvailableViews(views);
        if (views.length > 0 && !currentListViewId) {
          const defaultView = views.find(v => v.isDefault) || views[0];
          setIsEditingMenu(prev => prev ? { ...prev, listViewId: defaultView.id } : null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch list views:', err);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingMenu) return;
    setSaving(true);
    const method = isEditingMenu.id.startsWith('new-') ? 'POST' : 'PATCH';
    const isNew = isEditingMenu.id.startsWith('new-');
    const { children, appId: _appId, parentId: _parentId, dataModelId: _dataModelId, ...menuData } = isEditingMenu as any;
    const payload = isNew
      ? { ...menuData, appId, parentId: _parentId, dataModelId: _dataModelId, id: undefined as string | undefined }
      : { ...menuData, id: isEditingMenu.id };
    try {
      const res = await fetch('/api/console/menus', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (result.success) {
        setIsEditingMenu(null);
        fetchMenus();
      } else {
        alert(result.error || 'Failed to save menu item');
      }
    } catch (err) {
      alert('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenu = (menu: ConsoleMenu) => {
    setDeleteConfirmMenu(menu);
  };

  const confirmDeleteMenu = async () => {
    if (!deleteConfirmMenu) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/console/menus?id=${deleteConfirmMenu.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setDeleteConfirmMenu(null);
        fetchMenus();
      } else {
        alert(result.error || 'Failed to delete menu item');
      }
    } catch (err) {
      alert('Network error while deleting');
    } finally {
      setSaving(false);
    }
  };

  const findMenuWithParent = (
    items: ConsoleMenu[], id: string, parentId: string | null
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

  const replaceChildren = (items: ConsoleMenu[], parentId: string, replacement: ConsoleMenu[]): ConsoleMenu[] =>
    items.map(m =>
      m.id === parentId ? { ...m, children: replacement } :
        m.children ? { ...m, children: replaceChildren(m.children, parentId, replacement) } : m
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
    if (!el.contains(e.relatedTarget as Node)) el.classList.remove('sails-menu-item--drop-target');
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
    if (!dragId || dragId === targetId) return;
    reorderItem(dragId, targetId);
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
      fetchMenus();
    } catch (err) {
      alert('Failed to save ordering');
    } finally {
      setSaving(false);
    }
  };

  const renderMenuItem = (menu: ConsoleMenu, depth = 0, idx = 0, siblingCount = 1) => (
    <React.Fragment key={menu.id}>
      <div className="sails-menu-item" style={{ marginLeft: `${depth * 24}px` }}
        data-menu-id={menu.id} draggable
        onDragStart={(e) => handleDragStart(e, menu.id)}
        onDragOver={(e) => handleDragOver(e, menu.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, menu.id)}
        onDragEnd={handleDragEnd}>
        <div className="sails-menu-item__handle"><GripVertical size={16} /></div>
        <div className="sails-menu-item__icon"><DynamicIcon name={menu.icon || 'Circle'} size={16} /></div>
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
          <button onClick={() => handleMoveUp(menu.id)} disabled={idx === 0}
            title="Move Up" style={idx === 0 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
            <ChevronUp size={14} />
          </button>
          <button onClick={() => handleMoveDown(menu.id)} disabled={idx >= siblingCount - 1}
            title="Move Down" style={idx >= siblingCount - 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
            <ChevronDown size={14} />
          </button>
          <button onClick={() => setIsEditingMenu({
              ...menu,
              actionType: menu.actionType === 'table' ? 'data_model' : menu.actionType === 'plugin' ? 'custom' : menu.actionType
            })} title="Edit Menu"><Edit2 size={14} /></button>
          <button onClick={() => setIsEditingMenu({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'data_model', parentId: menu.id, order: 0 } as any)}
            title="Add Submenu"><Plus size={14} /></button>
          {!menu.isSystem && <button className="delete" onClick={() => handleDeleteMenu(menu)} title="Delete Menu"><Trash2 size={14} /></button>}
        </div>
      </div>
      {menu.children?.map((child, childIdx) => renderMenuItem(child, depth + 1, childIdx, menu.children!.length))}
    </React.Fragment>
  );

  return (
    <div className="sails-app-detail__section">
      <div className="sails-menu-manager__header">
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          Navigation Menus
          {hasOrderChanges && <span style={{ fontSize: '0.75rem', color: 'var(--sails-primary)', fontWeight: 400, marginLeft: '8px' }}>(unsaved)</span>}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasOrderChanges && (
            <button className="sails-btn sails-btn--primary" onClick={saveOrdering} disabled={saving}>
              {saving ? 'Saving...' : 'Save Ordering'}
            </button>
          )}
          <button className="sails-btn sails-btn--primary"
            onClick={() => setIsEditingMenu({ id: 'new-' + Date.now(), label: '', icon: 'Circle', path: '', actionType: 'data_model', parentId: null, order: menus.length } as any)}>
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

      {isEditingMenu && createPortal(
        <div className="sails-app-overlay">
          <div className="sails-app-create-dialog sails-app-create-dialog--menu">
            <div className="sails-app-create-dialog__header">
              <div className="sails-app-create-dialog__header-info">
                <div className="sails-app-create-dialog__header-icon">
                  <DynamicIcon name={isEditingMenu.icon || 'Circle'} size={22} />
                </div>
                <div>
                  <h3>{isEditingMenu.id.startsWith('new-') ? 'New Menu Item' : 'Edit Menu Item'}</h3>
                  <p>Configure navigation entry</p>
                </div>
              </div>
              <button className="sails-app-create-dialog__close" onClick={() => setIsEditingMenu(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveMenu} className="sails-app-create-dialog__body">
              <div className="sails-app-field-group">
                <label className="sails-app-field-label">Label</label>
                <input type="text" className="sails-input" value={isEditingMenu.label}
                  onChange={e => setIsEditingMenu({ ...isEditingMenu, label: e.target.value })} required />
              </div>
              <div className="sails-app-form-grid">
                <div className="sails-app-field-group">
                  <label className="sails-app-field-label">Icon</label>
                  <IconPicker value={isEditingMenu.icon || ''}
                    onChange={val => setIsEditingMenu({ ...isEditingMenu, icon: val })} />
                </div>
                <div className="sails-app-field-group">
                  <label className="sails-app-field-label">Type</label>
                  <CustomSelect
                    value={isEditingMenu.actionType}
                    options={[
                      { value: 'data_model', label: 'Data Model' },
                      { value: 'custom', label: 'Custom' }
                    ]}
                    onChange={val => setIsEditingMenu({
                      ...isEditingMenu,
                      actionType: String(val),
                      dataModelId: String(val) === 'custom' ? null : isEditingMenu.dataModelId
                    })} />
                </div>
              </div>
              {isEditingMenu.actionType === 'data_model' && (
                <div className="sails-app-field-group">
                  <label className="sails-app-field-label">Data Model</label>
                  <CustomSelect
                    searchable
                    value={isEditingMenu.dataModelId || ''}
                    options={dataModels.map(dm => ({ value: dm.id, label: dm.name }))}
                    onChange={val => {
                      const selected = dataModels.find(dm => dm.id === val);
                      setIsEditingMenu({
                        ...isEditingMenu,
                        dataModelId: String(val),
                        listViewId: null,
                        path: selected ? `/${appSlug}/${selected.tableName}` : isEditingMenu.path
                      });
                    }} />
                </div>
              )}
              {isEditingMenu.actionType === 'data_model' && availableViews.length > 0 && (
                <div className="sails-app-field-group">
                  <label className="sails-app-field-label">List View</label>
                  <CustomSelect
                    value={isEditingMenu.listViewId || ''}
                    options={availableViews.map(v => ({ value: v.id, label: v.name }))}
                    onChange={val => setIsEditingMenu({
                      ...isEditingMenu,
                      listViewId: String(val)
                    })} />
                </div>
              )}
              <div className="sails-app-field-group">
                <label className="sails-app-field-label">Browser Path</label>
                <input type="text" className="sails-input" value={isEditingMenu.path || ''}
                  onChange={e => setIsEditingMenu({ ...isEditingMenu, path: e.target.value })} placeholder="/crm/leads" />
              </div>
              {isEditingMenu.actionType === 'custom' && (
                <div className="sails-app-field-group">
                  <div className="sails-app-detail__placeholder" style={{ padding: '20px', textAlign: 'center' }}>
                    <h4>Coming Soon</h4>
                    <p>Custom page support will be available in a future update.</p>
                  </div>
                </div>
              )}
              <div className="sails-app-create-dialog__footer">
                <button type="button" className="sails-btn sails-btn--ghost" onClick={() => setIsEditingMenu(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="sails-btn sails-btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmMenu && createPortal(
        <div className="sails-app-overlay">
          <div className="sails-app-confirm-dialog">
            <div className="sails-app-confirm-dialog__header">
              <Trash2 size={22} style={{ color: 'var(--sails-danger)' }} />
              <span>Delete Menu Item</span>
            </div>
            <div className="sails-app-confirm-dialog__body">
              {deleteConfirmMenu.children && deleteConfirmMenu.children.length > 0 ? (
                <>This will delete <strong>"{deleteConfirmMenu.label}"</strong>. Its child items will be moved up one level.</>
              ) : (
                <>This will permanently delete <strong>"{deleteConfirmMenu.label}"</strong>. This action cannot be undone.</>
              )}
            </div>
            <div className="sails-app-confirm-dialog__footer">
              <button className="sails-btn sails-btn--ghost" onClick={() => setDeleteConfirmMenu(null)} disabled={saving}>Cancel</button>
              <button className="sails-btn sails-app-confirm-dialog__btn-danger" onClick={confirmDeleteMenu} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminAppManager;
