/**
 * AdminViewManager — list view activation/rollback management.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { createPortal } from 'react-dom';
import { LayoutTemplate, Search, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Trash2, Database, List, FileText, ClipboardList, X, ArrowUpDown, ChevronUp, ChevronDown, Calendar, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import { useDateTimePrefs, formatSystemDateTimeValue } from '../../utils/systemDateTime';
import { fetchCached } from '../../api/client';
import { TableLayout, LayoutType, ViewType, LayoutStatus, toSnakeCase } from '@sails/shared';
import { UiTableCard, UiTable, UiTh, UiTr, UiTd, UiNameCell, UiBadge, UiDateCell, UiActionsMenu, UiActionsItem, UiActionsDivider, UiPagination, UiConfirmDialog, UiToast } from '../../components/ui';
import './AdminViewManager.css';

interface LayoutRow extends TableLayout {
  table: { id: string; name: string; tableName: string } | null;
}

const VIEW_TYPE_LABELS: Record<ViewType, { label: string; icon: React.ElementType; className: string }> = {
  LIST: { label: 'List', icon: List, className: 'sails-layout-card__badge--list' },
  DETAIL: { label: 'Detail', icon: ClipboardList, className: 'sails-layout-card__badge--detail' },
  FORM: { label: 'Form', icon: FileText, className: 'sails-layout-card__badge--form' },
};

const AdminViewManager: React.FC = () => {
  const { t } = useTranslation();
  const datetimePrefs = useDateTimePrefs();
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
  const [activating, setActivating] = useState<string | null>(null);
  const [activateConfirmId, setActivateConfirmId] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'description' | 'tableName' | 'viewType' | 'status' | 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { setHeaderActions } = useConsole();

  const fetchData = useCallback(async (p: number, q: string, ps?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(ps ?? pageSize) });
      if (q) params.set('search', q);

      const json = await fetchCached(`/api/console/layouts?${params}`);
      if (!json.success) throw new Error(json.error || t('admin_view_manager.modal.createError'));
      setRows(json.data.rows);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err: any) {
      setError(err.message || t('admin_view_manager.modal.createError'));
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

  const handleSort = (key: 'name' | 'description' | 'tableName' | 'viewType' | 'status' | 'createdAt' | 'updatedAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'name' | 'description' | 'tableName' | 'viewType' | 'status' | 'createdAt' | 'updatedAt') => {
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
      <span>{t('admin_view_manager.actions.createLayout')}</span>
    </button>
  ), [t]);

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
      setDeletedSuccessMsg(t('admin_view_manager.toast.deleted'));
      setTimeout(() => setDeletedSuccessMsg(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || t('admin_view_manager.confirm.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const deleteTargetRow = deleteConfirmId ? rows.find(r => r.id === deleteConfirmId) : null;

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
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'activate' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: json.data.status, publishedConfig: json.data.publishedConfig } : r));
      setDeletedSuccessMsg(t('admin_view_manager.toast.activated'));
      setTimeout(() => setDeletedSuccessMsg(null), 4000);
    } catch (err: any) {
      setActivateError(err.message || t('admin_view_manager.confirm.activateError'));
    } finally {
      setActivating(null);
    }
  };

  const activateTargetRow = activateConfirmId ? rows.find(r => r.id === activateConfirmId) : null;

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
            placeholder={t('admin_view_manager.table.searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="sails-layout-studio__loading">
          <Spinner size={32} label={t('admin_view_manager.table.loading')} />
        </div>
      ) : error ? (
        <div className="sails-layout-studio__error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="sails-layout-studio__empty">
          <div className="sails-layout-studio__empty-icon">
            <LayoutTemplate size={28} />
          </div>
          <h3 className="sails-layout-studio__empty-title">{t('admin_view_manager.table.noLayoutsTitle')}</h3>
          <p className="sails-layout-studio__empty-text">
            {t('admin_view_manager.table.noLayoutsText')}
          </p>
    <button className="sails-btn sails-btn--primary" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}>
            <Plus size={16} />
            <span>{t('admin_view_manager.actions.createLayout')}</span>
          </button>
        </div>
      ) : (
        <>
          <UiTableCard>
            <UiTable>
              <thead>
                <tr>
                  <UiTh sortable sortState={sortConfig?.key === 'name' ? sortConfig.direction : 'idle'} onSort={() => handleSort('name')}>{t('admin_view_manager.table.columns.name')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'description' ? sortConfig.direction : 'idle'} onSort={() => handleSort('description')}>{t('admin_view_manager.table.columns.description')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'tableName' ? sortConfig.direction : 'idle'} onSort={() => handleSort('tableName')}>{t('admin_view_manager.table.columns.model')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'viewType' ? sortConfig.direction : 'idle'} onSort={() => handleSort('viewType')}>{t('admin_view_manager.table.columns.viewType')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'status' ? sortConfig.direction : 'idle'} onSort={() => handleSort('status')}>{t('admin_view_manager.table.columns.status')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'createdAt' ? sortConfig.direction : 'idle'} onSort={() => handleSort('createdAt')}>{t('admin_view_manager.table.columns.createdAt')}</UiTh>
                  <UiTh sortable sortState={sortConfig?.key === 'updatedAt' ? sortConfig.direction : 'idle'} onSort={() => handleSort('updatedAt')}>{t('admin_view_manager.table.columns.lastModified')}</UiTh>
                  <th style={{ textAlign: 'right', width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => {
                  const viewTypeInfo = VIEW_TYPE_LABELS[row.viewType as ViewType] || VIEW_TYPE_LABELS.LIST;
                  const ViewIcon = viewTypeInfo.icon;

                  return (
                    <UiTr key={row.id} onClick={() => handleOpenLayoutStudio(row)}>
                      <UiTd>
                        <UiNameCell
                          icon={<ViewIcon size={16} />}
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
                            {renderHighlightedText(row.table.name, search)}
                            {row.isDefault && <UiBadge tone="default">{t('admin_view_manager.table.default')}</UiBadge>}
                          </span>
                        ) : (
                          <UiBadge tone="neutral">{t('admin_view_manager.table.custom')}</UiBadge>
                        )}
                      </UiTd>
                      <UiTd>
                        <UiBadge tone="info">
                          <ViewIcon size={11} />
                          {viewTypeInfo.label === 'List' ? t('admin_view_manager.table.viewType.list') : viewTypeInfo.label === 'Detail' ? t('admin_view_manager.table.viewType.detail') : t('admin_view_manager.table.viewType.form')}
                        </UiBadge>
                      </UiTd>
                      <UiTd>
                        {row.status === 'active' ? (
                          <UiBadge tone="success"><CheckCircle2 size={11} /> {t('admin_view_manager.table.status.active')}</UiBadge>
                        ) : (
                          <UiBadge tone="warning"><Clock size={11} /> {t('admin_view_manager.table.status.draft')}</UiBadge>
                        )}
                      </UiTd>
                      <UiTd>
                        <UiDateCell><Calendar size={13} />{formatSystemDateTimeValue(row.createdAt, datetimePrefs)}</UiDateCell>
                      </UiTd>
                      <UiTd>
                        <UiDateCell><Calendar size={13} />{formatSystemDateTimeValue(row.updatedAt, datetimePrefs)}</UiDateCell>
                      </UiTd>
                      <UiTd align="right" onClick={e => e.stopPropagation()}>
                        <UiActionsMenu open={activeMenuId === row.id} onToggle={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}>
                          <UiActionsItem onClick={() => { setActiveMenuId(null); handleOpenLayoutStudio(row); }}>
                            <LayoutTemplate size={14} /> {t('admin_view_manager.actions.designInStudio')}
                          </UiActionsItem>

                          {row.status === 'draft' && (
                            <>
                              <UiActionsDivider />
                              <UiActionsItem onClick={() => { setActiveMenuId(null); handleActivate(row.id); }} disabled={activating === row.id}>
                                <Zap size={14} /> {activating === row.id ? t('admin_view_manager.actions.activating') : t('admin_view_manager.actions.activate')}
                              </UiActionsItem>
                            </>
                          )}

                          <UiActionsDivider />

                          <UiActionsItem danger onClick={() => { setActiveMenuId(null); handleDelete(row.id); }} disabled={deleting === row.id}>
                            <Trash2 size={14} /> {t('admin_view_manager.actions.delete')}
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
              label="layouts"
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            />
          </UiTableCard>
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

      <UiConfirmDialog
        open={!!deleteConfirmId && !!deleteTargetRow}
        title={t('admin_view_manager.confirm.deleteTitle')}
        icon={<AlertTriangle size={20} style={{ color: 'var(--sails-danger, #ef4444)' }} />}
        body={<Trans i18nKey="admin_view_manager.confirm.deleteBody" values={{ name: deleteTargetRow?.name }} components={{ 1: <strong /> }} />}
        error={deleteError}
        confirmLabel={deleting ? t('admin_view_manager.confirm.deletingLabel') : t('admin_view_manager.confirm.deleteLabel')}
        loading={!!deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <UiConfirmDialog
        open={!!activateConfirmId && !!activateTargetRow}
        title={t('admin_view_manager.confirm.activateTitle')}
        icon={<Zap size={20} style={{ color: 'var(--sails-primary, #3b82f6)' }} />}
        body={<Trans i18nKey="admin_view_manager.confirm.activateBody" values={{ name: activateTargetRow?.name }} components={{ 1: <strong /> }} />}
        error={activateError}
        confirmLabel={activating ? t('admin_view_manager.confirm.activatingLabel') : t('admin_view_manager.confirm.activateLabel')}
        tone="primary"
        loading={!!activating}
        onConfirm={doActivate}
        onCancel={() => setActivateConfirmId(null)}
      />

      <UiToast message={deletedSuccessMsg} />
    </div>
  );
};

interface CreateLayoutModalProps {
  onClose: () => void;
  onCreated: (data: LayoutRow) => void;
}

const CreateLayoutModal: React.FC<CreateLayoutModalProps> = ({ onClose, onCreated }) => {
  const { t } = useTranslation();
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
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const data = await fetchCached('/api/metadata/objects', undefined, 60000);
        if (Array.isArray(data)) {
          setTables(data.map((t: any) => ({ id: t.id, name: t.name || t.tableName })));
        }
      } catch { /* ignore */ }
    };
    fetchTables();
  }, []);

  const isCustom = layoutType === 'custom';

  const derivedSystemName = (val: string) => toSnakeCase(val);

  const validateSystemName = (val: string): string | null => {
    if (!val) return null;
    if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(val)) {
      return t('admin_view_manager.modal.systemNameError');
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
    setSubmitError(null);
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
              <LayoutTemplate size={24} />
            </div>
            <div>
              <h2 className="sails-layout-dialog__title">{t('admin_view_manager.modal.createTitle')}</h2>
              <p className="sails-layout-dialog__subtitle">{t('admin_view_manager.modal.createSubtitle')}</p>
            </div>
          </div>
          <button className="sails-layout-dialog__close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sails-layout-dialog__body">
          <div className="sails-layout-dialog__row">
            <div className="sails-layout-dialog__field">
              <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.nameLabel')}</label>
              <input
                type="text"
                className="sails-input"
                placeholder={t('admin_view_manager.modal.namePlaceholder')}
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
              <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.systemNameLabel')}</label>
              <input
                type="text"
                className={`sails-input ${systemNameError ? 'sails-layout-modal__input-error' : ''}`}
                placeholder={t('admin_view_manager.modal.systemNamePlaceholder')}
                value={systemName}
                onChange={e => {
                  const val = e.target.value;
                  setSystemName(val);
                  setSystemNameError(validateSystemName(val));
                  setSubmitError(null);
                }}
              />
              <span className="sails-layout-dialog__hint">{t('admin_view_manager.modal.systemNameHint')}</span>
            </div>
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.descriptionLabel')}</label>
            <textarea
              className="sails-input"
              placeholder={t('admin_view_manager.modal.descriptionPlaceholder')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
            />
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.layoutTypeLabel')}</label>
            <div className="sails-layout-modal__toggle">
              <button
                className={`sails-layout-modal__toggle-option ${layoutType === 'data' ? 'sails-layout-modal__toggle-option--active' : ''}`}
                onClick={() => { setLayoutType('data'); }}
              >
                <Database size={16} />
                {t('admin_view_manager.modal.layoutTypeData')}
              </button>
              <button
                className={`sails-layout-modal__toggle-option ${layoutType === 'custom' ? 'sails-layout-modal__toggle-option--active' : ''}`}
                onClick={() => { setLayoutType('custom'); setTableId(''); }}
              >
                <LayoutTemplate size={16} />
                {t('admin_view_manager.modal.layoutTypeCustom')}
              </button>
            </div>
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.modelLabel')}</label>
            <CustomSelect
              value={tableId}
              options={tables.map(t => ({ value: t.id, label: t.name }))}
              onChange={(val) => { setTableId(String(val)); setSubmitError(null); }}
              placeholder={isCustom ? t('admin_view_manager.modal.modelDisabledPlaceholder') : t('admin_view_manager.modal.modelPlaceholder')}
              searchable={true}
              disabled={isCustom}
            />
          </div>
          <div className="sails-layout-dialog__field">
            <label className="sails-layout-dialog__label">{t('admin_view_manager.modal.viewTypeLabel')}</label>
            <div className="sails-layout-modal__view-options">
              {(['LIST', 'DETAIL'] as ViewType[]).map(vt => {
                const info = VIEW_TYPE_LABELS[vt];
                const Icon = info.icon;
                return (
                  <button
                    key={vt}
                    className={`sails-layout-modal__view-option ${viewType === vt ? 'sails-layout-modal__view-option--selected' : ''}`}
                    onClick={() => setViewType(vt)}
                  >
                    <Icon size={20} />
                    <span>{info.label === 'List' ? t('admin_view_manager.table.viewType.list') : info.label === 'Detail' ? t('admin_view_manager.table.viewType.detail') : t('admin_view_manager.table.viewType.form')}</span>
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
            {t('admin_view_manager.modal.setAsDefault')}
          </label>
          {submitError && <div className="sails-confirm-modal__error">{submitError}</div>}
        </div>
        <div className="sails-layout-dialog__footer">
          <button className="sails-btn sails-btn--ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="sails-btn sails-btn--primary"
            onClick={handleCreate}
            disabled={!name || !systemName || (!isCustom && !tableId) || submitting}
          >
            {submitting ? t('admin_view_manager.modal.creating') : t('admin_view_manager.actions.createLayout')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminViewManager;
