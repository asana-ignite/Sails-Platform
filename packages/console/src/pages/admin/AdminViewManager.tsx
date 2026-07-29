import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LayoutTemplate, Search, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Trash2, Database, List, FileText, ClipboardList, X, ArrowUpDown, ChevronUp, ChevronDown, Calendar, AlertTriangle } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import { TableLayout, LayoutType, ViewType } from '@sails/shared';
import './AdminViewManager.css';

interface LayoutRow extends TableLayout {
  table: { id: string; name: string; tableName: string } | null;
}

const VIEW_TYPE_LABELS: Record<ViewType, { label: string; icon: React.ElementType; className: string }> = {
  LIST: { label: 'List', icon: List, className: 'sails-layout-card__badge--list' },
  DETAIL: { label: 'Detail', icon: FileText, className: 'sails-layout-card__badge--detail' },
  FORM: { label: 'Form', icon: ClipboardList, className: 'sails-layout-card__badge--form' },
};

const AdminViewManager: React.FC = () => {
  const [rows, setRows] = useState<LayoutRow[]>([]);
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
  const [deletedSuccessMsg, setDeletedSuccessMsg] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'description' | 'tableName' | 'viewType' | 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { setHeaderActions } = useConsole();

  const fetchData = useCallback(async (p: number, q: string, ps?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(ps ?? pageSize) });
      if (q) params.set('search', q);

      const res = await fetch(`/api/console/layouts?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load layouts');
      setRows(json.data.rows);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load layouts');
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

  const handleSort = (key: 'name' | 'description' | 'tableName' | 'viewType' | 'createdAt' | 'updatedAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'name' | 'description' | 'tableName' | 'viewType' | 'createdAt' | 'updatedAt') => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="lav-sort-icon--idle" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal: any, bVal: any;
      switch (key) {
        case 'tableName':
          aVal = a.table?.name ?? '';
          bVal = b.table?.name ?? '';
          break;
        case 'viewType':
          aVal = a.viewType;
          bVal = b.viewType;
          break;
        default:
          aVal = a[key] ?? '';
          bVal = b[key] ?? '';
          break;
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortConfig]);

  const headerActions = useMemo(() => (
    <button className="sails-btn sails-btn--primary" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}>
      <Plus size={16} />
      <span>Create Layout</span>
    </button>
  ), []);

  useEffect(() => {
    setHeaderActions(headerActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, headerActions]);

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
      const res = await fetch(`/api/console/layouts?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
      setDeletedSuccessMsg('Layout deleted successfully.');
      setTimeout(() => setDeletedSuccessMsg(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete layout');
    } finally {
      setDeleting(null);
    }
  };

  const deleteTargetRow = deleteConfirmId ? rows.find(r => r.id === deleteConfirmId) : null;

  const handleOpenLayoutStudio = (row: LayoutRow) => {
    const targetId = row.table?.id || row.tableId;
    window.open(`/layout-studio/${targetId || '_custom'}/${row.id}`, '_blank');
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
            placeholder="Search layouts by name or table..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="sails-layout-studio__loading">
          <Spinner size={32} label="Loading layouts..." />
        </div>
      ) : error ? (
        <div className="sails-layout-studio__error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="sails-layout-studio__empty">
          <div className="sails-layout-studio__empty-icon">
            <LayoutTemplate size={28} />
          </div>
          <h3 className="sails-layout-studio__empty-title">No layouts yet</h3>
          <p className="sails-layout-studio__empty-text">
            Create your first layout to define how data is displayed in list, detail, and form views.
          </p>
    <button className="sails-btn sails-btn--primary" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}>
            <Plus size={16} />
            <span>Create Layout</span>
          </button>
        </div>
      ) : (
        <>
          <div className="om-table-card">
            <table className="om-list-table">
              <thead>
                <tr>
                  <th className="lav-th-sortable" onClick={() => handleSort('name')}>
                    <div className="lav-th-content">
                      <span>Name</span>
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th className="lav-th-sortable" onClick={() => handleSort('description')}>
                    <div className="lav-th-content">
                      <span>Description</span>
                      {getSortIcon('description')}
                    </div>
                  </th>
                  <th className="lav-th-sortable" onClick={() => handleSort('tableName')}>
                    <div className="lav-th-content">
                      <span>Model</span>
                      {getSortIcon('tableName')}
                    </div>
                  </th>
                  <th className="lav-th-sortable" onClick={() => handleSort('viewType')}>
                    <div className="lav-th-content">
                      <span>View Type</span>
                      {getSortIcon('viewType')}
                    </div>
                  </th>
                  <th className="lav-th-sortable" onClick={() => handleSort('createdAt')}>
                    <div className="lav-th-content">
                      <span>Created At</span>
                      {getSortIcon('createdAt')}
                    </div>
                  </th>
                  <th className="lav-th-sortable" onClick={() => handleSort('updatedAt')}>
                    <div className="lav-th-content">
                      <span>Last Modified</span>
                      {getSortIcon('updatedAt')}
                    </div>
                  </th>
                  <th style={{ textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => {
                  const viewTypeInfo = VIEW_TYPE_LABELS[row.viewType as ViewType] || VIEW_TYPE_LABELS.LIST;
                  const ViewIcon = viewTypeInfo.icon;

                  return (
                    <tr key={row.id} className="lav-clickable-row">
                      <td>
                        <div className="lav-cell-name">
                          <div className="lav-icon-wrapper">
                            <LayoutTemplate size={16} />
                          </div>
                          <div className="lav-cell-name__text">
                            <span className="lav-name-primary">{renderHighlightedText(row.name, search)}</span>
                            <code className="lav-system-name">/{renderHighlightedText(row.systemName, search)}</code>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="lav-desc-text">
                          {row.description
                            ? renderHighlightedText(row.description, search)
                            : <span className="lav-text-muted">—</span>}
                        </span>
                      </td>
                      <td>
                        {row.table ? (
                          <span className="lav-model-cell">
                            <span className="lav-model-link">
                              <Database size={12} />
                              {renderHighlightedText(row.table.name, search)}
                            </span>
                            {row.isDefault && (
                              <span className="sails-layout-card__badge sails-layout-card__badge--default">Default</span>
                            )}
                          </span>
                        ) : (
                          <span className="sails-layout-card__badge sails-layout-card__badge--custom">Custom</span>
                        )}
                      </td>
                      <td>
                        <span className={`sails-layout-card__badge ${viewTypeInfo.className}`}>
                          <ViewIcon size={11} />
                          {viewTypeInfo.label}
                        </span>
                      </td>
                      <td>
                        <span className="lav-date-cell">
                          <Calendar size={13} style={{ marginRight: '4px' }} />
                          {new Date(row.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <span className="lav-date-cell">
                          <Calendar size={13} style={{ marginRight: '4px' }} />
                          {new Date(row.updatedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div className="lav-action-wrapper">
                          <button
                            className={`sails-btn sails-btn--ghost ${activeMenuId === row.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === row.id ? null : row.id);
                            }}
                            title="Options"
                            aria-label="Options"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {activeMenuId === row.id && (
                            <div className="lav-context-menu" onClick={e => e.stopPropagation()}>
                              <button
                                className="lav-context-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleOpenLayoutStudio(row);
                                }}
                              >
                                <LayoutTemplate size={14} />
                                <span>Design in Layout Studio</span>
                              </button>

                              <div className="lav-context-divider"></div>

                              <button
                                className="lav-context-item lav-context-item--danger"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleDelete(row.id);
                                }}
                                disabled={deleting === row.id}
                              >
                                <Trash2 size={14} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="sails-user-manager__pagination" style={{ borderTop: '1px solid var(--sails-border-color)' }}>
              <div className="sails-user-manager__pagination-info">
                <span className="sails-user-manager__pagination-range">
                  Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{total}</strong> layouts
                </span>
                <div className="sails-user-manager__page-size">
                  <span className="sails-user-manager__page-size-label">Records per page:</span>
                  <CustomSelect
                    size="sm"
                    value={pageSize}
                    options={[
                      { value: 10, label: '10' },
                      { value: 25, label: '25' },
                      { value: 50, label: '50' },
                    ]}
                    onChange={(val) => {
                      setPageSize(Number(val));
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="sails-user-manager__pagination-controls">
                <button
                  className="sails-pagination-btn"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="sails-pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`sails-pagination-page ${page === p ? 'sails-pagination-page--active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  className="sails-pagination-btn"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || totalPages === 0}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateLayoutModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(data) => {
            setShowCreateModal(false);
            setPage(1);
            fetchData(1, search);
            const tid = data.table?.id || data.tableId || '_custom';
            window.open(`/layout-studio/${tid}/${data.id}`, '_blank');
          }}
        />
      )}

      {deleteConfirmId && deleteTargetRow && createPortal(
        <div className="sails-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="sails-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="sails-confirm-modal__header">
              <AlertTriangle size={20} style={{ color: 'var(--sails-danger, #ef4444)' }} />
              <span>Delete Layout</span>
            </div>
            <div className="sails-confirm-modal__body">
              Are you sure you want to delete <strong>{deleteTargetRow.name}</strong>? This cannot be undone.
              {deleteError && <div className="sails-confirm-modal__error">{deleteError}</div>}
            </div>
            <div className="sails-confirm-modal__footer">
              <button className="sails-btn sails-btn--ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button
                className="sails-btn sails-btn--danger"
                onClick={doDelete}
                disabled={deleting === deleteConfirmId}
              >
                {deleting === deleteConfirmId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deletedSuccessMsg && (
        <div className="sails-layout-studio__toast sails-layout-studio__toast--success">
          <span>{deletedSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};

interface CreateLayoutModalProps {
  onClose: () => void;
  onCreated: (data: LayoutRow) => void;
}

const CreateLayoutModal: React.FC<CreateLayoutModalProps> = ({ onClose, onCreated }) => {
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [tableId, setTableId] = useState('');
  const [name, setName] = useState('');
  const [systemName, setSystemName] = useState('');
  const [description, setDescription] = useState('');
  const [layoutType, setLayoutType] = useState<LayoutType>('data');
  const [viewType, setViewType] = useState<ViewType>('LIST');
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [systemNameError, setSystemNameError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch('/api/metadata/objects');
        const data = await res.json();
        if (Array.isArray(data)) {
          setTables(data.map((t: any) => ({ id: t.id, name: t.name || t.tableName })));
        }
      } catch { /* ignore */ }
    };
    fetchTables();
  }, []);

  const isCustom = layoutType === 'custom';

  const derivedSystemName = (val: string) =>
    val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const validateSystemName = (val: string): string | null => {
    if (!val) return null;
    if (!/^[a-zA-Z0-9]+$/.test(val)) {
      return 'System Name must contain only English letters and numbers (no spaces or special characters).';
    }
    return null;
  };

  const handleCreate = async () => {
    if (!name || !systemName) return;
    if (!isCustom && !tableId) return;

    const err = validateSystemName(systemName);
    if (err) {
      setSystemNameError(err);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: isCustom ? null : tableId,
          layoutType,
          viewType,
          name,
          systemName,
          description: description || undefined,
          isDefault
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onCreated(json.data);
    } catch (err: any) {
      alert(err.message);
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
              <LayoutTemplate size={24} />
            </div>
            <div>
              <h2 className="sails-layout-dialog__title">Create Layout</h2>
              <p className="sails-layout-dialog__subtitle">Define a new layout for displaying data.</p>
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
                placeholder="e.g. Lead List Default"
                value={name}
                onChange={e => {
                  const val = e.target.value;
                  setName(val);
                  setSystemName(derivedSystemName(val));
                  setSystemNameError(null);
                }}
              />
            </div>
            <div className="sails-layout-dialog__field">
              <label className="sails-layout-dialog__label">System Name *</label>
              <input
                type="text"
                className={`sails-input ${systemNameError ? 'sails-layout-modal__input-error' : ''}`}
                placeholder="e.g. leadlistdefault"
                value={systemName}
                onChange={e => {
                  const val = e.target.value;
                  setSystemName(val);
                  setSystemNameError(validateSystemName(val));
                }}
              />
              <span className="sails-layout-dialog__hint">Alphanumeric only (e.g. leadlistdefault).</span>
            </div>
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">Description</label>
            <textarea
              className="sails-input"
              placeholder="Optional description of this layout"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
            />
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">Layout Type</label>
            <div className="sails-layout-modal__toggle">
              <button
                className={`sails-layout-modal__toggle-option ${layoutType === 'data' ? 'sails-layout-modal__toggle-option--active' : ''}`}
                onClick={() => { setLayoutType('data'); }}
              >
                <Database size={16} />
                Data
              </button>
              <button
                className={`sails-layout-modal__toggle-option ${layoutType === 'custom' ? 'sails-layout-modal__toggle-option--active' : ''}`}
                onClick={() => { setLayoutType('custom'); setTableId(''); }}
              >
                <LayoutTemplate size={16} />
                Custom
              </button>
            </div>
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">Model</label>
            <CustomSelect
              value={tableId}
              options={tables.map(t => ({ value: t.id, label: t.name }))}
              onChange={(val) => setTableId(String(val))}
              placeholder={isCustom ? 'Not applicable for custom layouts' : 'Select a model...'}
              searchable={true}
              disabled={isCustom}
            />
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">View Type</label>
            <div className="sails-layout-modal__view-options">
              {(['LIST', 'DETAIL', 'FORM'] as ViewType[]).map(vt => {
                const info = VIEW_TYPE_LABELS[vt];
                const Icon = info.icon;
                return (
                  <button
                    key={vt}
                    className={`sails-layout-modal__view-option ${viewType === vt ? 'sails-layout-modal__view-option--selected' : ''}`}
                    onClick={() => setViewType(vt)}
                  >
                    <Icon size={20} />
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="sails-checkbox-label">
            <input
              type="checkbox"
              className="sails-checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
            />
            Set as default view
          </label>
        </div>
        <div className="sails-layout-dialog__footer">
          <button className="sails-btn sails-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="sails-btn sails-btn--primary"
            onClick={handleCreate}
            disabled={!name || !systemName || (!isCustom && !tableId) || submitting}
          >
            {submitting ? 'Creating...' : 'Create Layout'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminViewManager;
