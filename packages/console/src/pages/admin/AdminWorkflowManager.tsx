import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Workflow, Search, Plus, Trash2, Database, X, ArrowUpDown, Calendar, AlertTriangle, CheckCircle2, Clock, Zap, Power, History, PencilRuler } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import { fetchCached } from '../../api/client';
import { UiTableCard, UiTable, UiTh, UiTr, UiTd, UiNameCell, UiBadge, UiDateCell, UiActionsMenu, UiActionsItem, UiActionsDivider, UiPagination, UiConfirmDialog, UiToast } from '../../components/ui';
import './AdminViewManager.css';

interface WorkflowRow {
  id: string;
  tenantId: string;
  name: string;
  systemName: string;
  description: string | null;
  tableId: string | null;
  status: 'draft' | 'active' | 'deactivated';
  currentVersion: number;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
  table?: { id: string; name: string; tableName: string } | null;
}

const STATUS_LABELS: Record<WorkflowRow['status'], { label: string; icon: React.ElementType; className: string }> = {
  active: { label: 'Active', icon: CheckCircle2, className: 'sails-layout-card__badge--active' },
  draft: { label: 'Draft', icon: Clock, className: 'sails-layout-card__badge--draft' },
  deactivated: { label: 'Deactivated', icon: Power, className: 'sails-layout-card__badge--form' },
};

const AdminWorkflowManager: React.FC = () => {
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [activateConfirmId, setActivateConfirmId] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'description' | 'status' | 'createdAt' | 'updatedAt' | 'versions'; direction: 'asc' | 'desc' } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { setHeaderActions } = useConsole();

  const fetchData = useCallback(async (p: number, q: string, ps?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(ps ?? pageSize) });
      if (q) params.set('search', q);

      const json = await fetchCached(`/api/workflows?${params}`);
      if (!json.success) throw new Error(json.error || 'Failed to load workflows');
      setRows(json.data.rows);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchData(page, search);
  }, [page, search, fetchData]);

  useEffect(() => {
    const handler = () => setActiveMenuId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const handleSort = (key: 'name' | 'description' | 'status' | 'createdAt' | 'updatedAt' | 'versions') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'name' | 'description' | 'status' | 'createdAt' | 'updatedAt' | 'versions') => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ui-sort-icon" />;
    return sortConfig.direction === 'asc' ? <ArrowUpDown size={14} style={{ color: 'var(--sails-primary)' }} /> : <ArrowUpDown size={14} style={{ color: 'var(--sails-primary)', transform: 'rotate(180deg)' }} />;
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal: any;
      let bVal: any;
      if (key === 'versions') {
        aVal = a._count?.versions ?? 0;
        bVal = b._count?.versions ?? 0;
      } else {
        aVal = a[key];
        bVal = b[key];
      }
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = String(bVal).toLowerCase(); }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortConfig]);

  const headerActions = useMemo(() => (
    <button className="sails-btn sails-btn--primary" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}>
      <Plus size={16} />
      <span>Create Workflow</span>
    </button>
  ), []);

  useEffect(() => {
    setHeaderActions(headerActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, headerActions]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const deleteTargetRow = deleteConfirmId ? rows.find(r => r.id === deleteConfirmId) : null;
  const activateTargetRow = activateConfirmId ? rows.find(r => r.id === activateConfirmId) : null;
  const deactivateTargetRow = deactivateConfirmId ? rows.find(r => r.id === deactivateConfirmId) : null;

  const handleDelete = (id: string) => {
    setDeleteError(null);
    setDeleteConfirmId(id);
  };

  const doDelete = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    setDeleting(id);
    setDeleteConfirmId(null);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/workflows?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
      showToast('Workflow deleted successfully.');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete workflow');
    } finally {
      setDeleting(null);
    }
  };

  const handleActivate = (id: string) => {
    setActivateError(null);
    setActivateConfirmId(id);
  };

  const doActivate = async () => {
    const id = activateConfirmId;
    if (!id) return;
    setActivating(id);
    setActivateConfirmId(null);
    setActivateError(null);
    try {
      const res = await fetch('/api/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'activate' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: json.data.status, currentVersion: json.data.currentVersion, _count: { versions: (r._count?.versions ?? 0) + 1 } } : r));
      showToast(`Workflow activated — version ${json.data.currentVersion - 1} published.`);
    } catch (err: any) {
      setActivateError(err.message || 'Failed to activate workflow');
    } finally {
      setActivating(null);
    }
  };

  const handleDeactivate = (id: string) => {
    setDeactivateError(null);
    setDeactivateConfirmId(id);
  };

  const doDeactivate = async () => {
    const id = deactivateConfirmId;
    if (!id) return;
    setDeactivating(id);
    setDeactivateConfirmId(null);
    setDeactivateError(null);
    try {
      const res = await fetch('/api/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'deactivate' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: json.data.status } : r));
      showToast('Workflow deactivated. Running instances continue on their pinned version.');
    } catch (err: any) {
      setDeactivateError(err.message || 'Failed to deactivate workflow');
    } finally {
      setDeactivating(null);
    }
  };

  const handleOpenDesigner = (row: WorkflowRow) => {
    window.open(`/workflow-studio/${row.id}`, '_blank');
  };

  const startRecord = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, total);

  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    if (!query || !query.trim() || !text) return text;
    const trimmedQuery = query.trim();
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === trimmedQuery.toLowerCase() ? (
            <mark key={i} className="sails-layout-studio__highlight">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="sails-layout-studio">
      <div className="sails-layout-studio__toolbar">
        <div className="sails-layout-studio__search">
          <Search size={16} className="sails-layout-studio__search-icon" />
          <input
            type="text"
            className="sails-layout-studio__search-input"
            placeholder="Search workflows by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {toastMsg && (
        <div className="sails-layout-studio__toast sails-layout-studio__toast--success">
          <CheckCircle2 size={14} />
          <span>{toastMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="sails-layout-studio__loading">
          <Spinner size={32} label="Loading workflows..." />
        </div>
      ) : error ? (
        <div className="sails-layout-studio__error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="sails-layout-studio__empty">
          <div className="sails-layout-studio__empty-icon">
            <Workflow size={28} />
          </div>
          <h3 className="sails-layout-studio__empty-title">No workflows yet</h3>
          <p className="sails-layout-studio__empty-text">
            Create your first workflow to automate approval processes across your models.
          </p>
          <button className="sails-btn sails-btn--primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create Workflow</span>
          </button>
        </div>
      ) : (
        <>
          <UiTableCard>
          <UiTable>
            <thead>
              <tr>
                <UiTh sortable sortState={sortConfig?.key === 'name' ? sortConfig.direction : 'idle'} onSort={() => handleSort('name')}>Workflow</UiTh>
                <UiTh sortable sortState={sortConfig?.key === 'description' ? sortConfig.direction : 'idle'} onSort={() => handleSort('description')}>Description</UiTh>
                <UiTh>Model</UiTh>
                <UiTh sortable sortState={sortConfig?.key === 'versions' ? sortConfig.direction : 'idle'} onSort={() => handleSort('versions')}>Versions</UiTh>
                <UiTh sortable sortState={sortConfig?.key === 'status' ? sortConfig.direction : 'idle'} onSort={() => handleSort('status')}>Status</UiTh>
                <UiTh sortable sortState={sortConfig?.key === 'createdAt' ? sortConfig.direction : 'idle'} onSort={() => handleSort('createdAt')}>Created At</UiTh>
                <UiTh sortable sortState={sortConfig?.key === 'updatedAt' ? sortConfig.direction : 'idle'} onSort={() => handleSort('updatedAt')}>Last Modified</UiTh>
                <th style={{ textAlign: 'right', width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => {
                const statusInfo = STATUS_LABELS[row.status] || STATUS_LABELS.draft;
                const StatusIcon = statusInfo.icon;
                return (
                  <UiTr key={row.id} onClick={() => handleOpenDesigner(row)}>
                    <UiTd>
                      <UiNameCell
                        icon={<Workflow size={16} />}
                        primary={renderHighlightedText(row.name, search)}
                        secondary={renderHighlightedText(row.systemName, search)}
                        secondaryAsCode
                      />
                    </UiTd>
                    <UiTd>
                      <span className="ui-desc-text">
                        {row.description
                          ? renderHighlightedText(row.description, search)
                          : <span className="ui-text-muted">—</span>}
                      </span>
                    </UiTd>
                    <UiTd>
                      {row.table ? (
                        <span className="ui-name-cell" style={{ gap: 8 }}>
                          <Database size={12} />
                          {row.table.name}
                          {row.isDefault && <UiBadge tone="default">Default</UiBadge>}
                        </span>
                      ) : (
                        <span className="ui-text-muted">—</span>
                      )}
                    </UiTd>
                    <UiTd>
                      <span className="ui-name-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <History size={12} />
                        {row._count?.versions ?? 0}
                      </span>
                    </UiTd>
                    <UiTd>
                      <UiBadge tone={statusInfo.label === 'Active' ? 'success' : statusInfo.label === 'Deactivated' ? 'warning' : 'neutral'}>
                        <StatusIcon size={11} />
                        {statusInfo.label}
                      </UiBadge>
                    </UiTd>
                    <UiTd>
                      <UiDateCell><Calendar size={13} />{new Date(row.createdAt).toLocaleDateString()}</UiDateCell>
                    </UiTd>
                    <UiTd>
                      <UiDateCell><Calendar size={13} />{new Date(row.updatedAt).toLocaleDateString()}</UiDateCell>
                    </UiTd>
                    <UiTd align="right" onClick={e => e.stopPropagation()}>
                      <UiActionsMenu open={activeMenuId === row.id} onToggle={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}>
                        <UiActionsItem onClick={() => { setActiveMenuId(null); handleOpenDesigner(row); }}>
                          <PencilRuler size={14} /> Design Workflow
                        </UiActionsItem>

                        {row.status === 'draft' && (
                          <>
                            <UiActionsDivider />
                            <UiActionsItem onClick={() => { setActiveMenuId(null); handleActivate(row.id); }} disabled={activating === row.id}>
                              <Zap size={14} /> {activating === row.id ? 'Activating...' : 'Activate'}
                            </UiActionsItem>
                          </>
                        )}

                        {row.status === 'active' && (
                          <>
                            <UiActionsDivider />
                            <UiActionsItem onClick={() => { setActiveMenuId(null); handleDeactivate(row.id); }} disabled={deactivating === row.id}>
                              <Power size={14} /> {deactivating === row.id ? 'Deactivating...' : 'Deactivate'}
                            </UiActionsItem>
                          </>
                        )}

                        <UiActionsDivider />

                        <UiActionsItem danger onClick={() => { setActiveMenuId(null); handleDelete(row.id); }} disabled={deleting === row.id}>
                          <Trash2 size={14} /> Delete
                        </UiActionsItem>
                      </UiActionsMenu>
                    </UiTd>
                  </UiTr>
                );
              })}
            </tbody>
          </UiTable>

          <UiPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            label="workflows"
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
          </UiTableCard>
        </>
      )}

      {showCreateModal && (
        <CreateWorkflowModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(data) => {
            setShowCreateModal(false);
            setPage(1);
            fetchData(1, search);
            window.open(`/workflow-studio/${data.id}`, '_blank');
          }}
        />
      )}

      <UiConfirmDialog
        open={!!deleteConfirmId && !!deleteTargetRow}
        title="Delete Workflow"
        icon={<AlertTriangle size={20} style={{ color: 'var(--sails-danger, #ef4444)' }} />}
        body={<>Are you sure you want to delete <strong>{deleteTargetRow?.name}</strong>? This cannot be undone.</>}
        error={deleteError}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        loading={!!deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <UiConfirmDialog
        open={!!activateConfirmId && !!activateTargetRow}
        title="Activate Workflow"
        icon={<Zap size={20} style={{ color: 'var(--sails-primary)' }} />}
        body={<>Publish <strong>{activateTargetRow?.name}</strong> as version {activateTargetRow?.currentVersion}? Running instances keep their pinned version — new instances will use this one.</>}
        error={activateError}
        confirmLabel={activating ? 'Activating...' : `Activate v${activateTargetRow?.currentVersion}`}
        tone="primary"
        loading={!!activating}
        onConfirm={doActivate}
        onCancel={() => setActivateConfirmId(null)}
      />

      <UiConfirmDialog
        open={!!deactivateConfirmId && !!deactivateTargetRow}
        title="Deactivate Workflow"
        icon={<Power size={20} style={{ color: 'var(--sails-warning, #f59e0b)' }} />}
        body={<>Deactivate <strong>{deactivateTargetRow?.name}</strong>? No new instances can start. Existing running instances continue on their pinned version until completed.</>}
        error={deactivateError}
        confirmLabel={deactivating ? 'Deactivating...' : 'Deactivate'}
        loading={!!deactivating}
        onConfirm={doDeactivate}
        onCancel={() => setDeactivateConfirmId(null)}
      />

      <UiToast message={toastMsg} />
    </div>
  );
};

// ─── Create Workflow Modal ────────────────────────────────────

interface CreateWorkflowModalProps {
  onClose: () => void;
  onCreated: (data: any) => void;
}

interface TableOption {
  id: string;
  name: string;
  tableName: string;
}

const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [systemNameError, setSystemNameError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [tableId, setTableId] = useState('');
  const [tables, setTables] = useState<TableOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCached('/api/metadata/objects', undefined, 60000)
      .then((data: any) => {
        if (!mounted) return;
        const list: TableOption[] = Array.isArray(data) ? data : (data?.rows || data?.data || []);
        setTables(list.map((t) => ({ id: t.id, name: t.name, tableName: t.tableName })));
      })
      .catch(() => { /* model list optional */ });
    return () => { mounted = false; };
  }, []);

  const derivedSystemName = (val: string) =>
    val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const validateSystemName = (val: string): string | null => {
    if (!val) return null;
    if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(val)) {
      return 'System Name must be in valid snake_case (e.g. contract_review).';
    }
    return null;
  };

  const handleCreate = async () => {
    if (!name || !systemName) return;
    const err = validateSystemName(systemName);
    if (err) {
      setSystemNameError(err);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: tableId || undefined,
          name,
          systemName,
          description: description || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onCreated(json.data);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="sails-layout-overlay" onClick={onClose}>
      <div className="sails-layout-dialog" onClick={e => e.stopPropagation()}>
        <div className="sails-layout-dialog__header">
          <div className="sails-layout-dialog__header-info">
            <div className="sails-layout-dialog__icon">
              <Workflow size={24} />
            </div>
            <div>
              <h2 className="sails-layout-dialog__title">Create Workflow</h2>
              <p className="sails-layout-dialog__subtitle">Define an approval workflow for a data model.</p>
            </div>
          </div>
          <button className="sails-layout-dialog__close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sails-layout-dialog__body">
          <div className="sails-layout-dialog__row">
            <div className="sails-layout-dialog__field">
              <label className="sails-layout-dialog__label">Name *</label>
              <input
                type="text"
                className="sails-input"
                placeholder="e.g. Contract Review"
                value={name}
                onChange={e => {
                  const val = e.target.value;
                  setName(val);
                  setSystemName(derivedSystemName(val));
                  setSystemNameError(null);
                  setSubmitError(null);
                }}
              />
            </div>
            <div className="sails-layout-dialog__field">
              <label className="sails-layout-dialog__label">System Name *</label>
              <input
                type="text"
                className={`sails-input ${systemNameError ? 'sails-layout-modal__input-error' : ''}`}
                placeholder="e.g. contract_review"
                value={systemName}
                onChange={e => {
                  const val = e.target.value;
                  setSystemName(val);
                  setSystemNameError(validateSystemName(val));
                  setSubmitError(null);
                }}
              />
              <span className="sails-layout-dialog__hint">Snake case only (e.g. contract_review).</span>
            </div>
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">Description</label>
            <textarea
              className="sails-input"
              placeholder="Optional description of this workflow"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">Model (optional)</label>
            <CustomSelect
              value={tableId}
              options={tables.map(t => ({ value: t.id, label: t.name }))}
              onChange={(val) => { setTableId(String(val)); setSubmitError(null); }}
              placeholder="Select a model..."
              searchable={true}
            />
            <span className="sails-layout-dialog__hint">The data model this workflow runs on. Leave empty for a standalone workflow.</span>
          </div>
          {submitError && <div className="sails-confirm-modal__error">{submitError}</div>}
        </div>
        <div className="sails-layout-dialog__footer">
          <button className="sails-btn sails-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="sails-btn sails-btn--primary"
            onClick={handleCreate}
            disabled={!name || !systemName || submitting}
          >
            {submitting ? 'Creating...' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminWorkflowManager;
