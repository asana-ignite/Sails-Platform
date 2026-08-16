/**
 * ListViewEngine — the runtime LIST view: loads the layout config + fields,
 * fetches records through /api/dynamic (page mode) or /related (embedded
 * related lists), and drives search/filter/sort/pagination, inline
 * create/edit/delete, live aggregate totals and the actions bar.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Columns, AlertCircle, RotateCcw, Filter } from 'lucide-react';
import type { TableLayout, SailsFieldDefinition, ListAction, FilterGroup } from '@sails/shared';
import { isSystemField, normalizeFilters, serializeFilterGroups, validateRecord, sanitizeWritePayload } from '@sails/shared';
import { ListViewTable, type RuntimeSortRule } from './ListViewTable';
import { ListViewMobile } from './ListViewMobile';
import DynamicIcon from '../common/DynamicIcon';
import LoadingScreen from '../common/LoadingScreen';
import { fetchCached } from '../../api/client';
import { ActionRegistry } from '../../features/actions';
import { useRecordStack } from '../../contexts/RecordStackContext';

export interface ListViewEngineProps {
  /** Physical table name of the model being listed. */
  tableName: string;
  /** LIST layout id or systemName to render (undefined → synthetic default). */
  layoutId?: string;
  /** Pre-resolved layout (optional, avoids extra network requests). */
  initialLayout?: any;
  /** Pre-resolved field definitions (optional). */
  initialFields?: SailsFieldDefinition[];
  /** Related mode: list only records whose FK `fieldName` equals `parentRecordId`. */
  related?: { fieldName: string; parentRecordId: string };
  /** Table/card title. */
  title: string;
  /** Full-page navigation mode (list page). When absent, `onRecordOpen` is used instead. */
  menuPath?: string;
  navigate?: (path: string | number) => void;
  /** Open a record (related mode → record stack push). */
  onRecordOpen?: (rec: any, detailLayoutKey?: string) => void;
  /** Table id for action contexts (optional; derived from the layout otherwise). */
  tableId?: string;
  embedded?: boolean;
  /** Where to render the view's action buttons: 'card' (header slot) or 'none' (parent renders via onActionsReady). */
  actionsBar?: 'card' | 'none';
  /** Hands the configured actions + executor to the parent (used when actionsBar='none', e.g. page header). */
  onActionsReady?: (actions: ListAction[], execute: (action: ListAction) => void) => void;
}

const defaultSyntheticConfig = (tableFields: SailsFieldDefinition[]) => ({
  columns: tableFields
    .filter((f) => !isSystemField(f.fieldName))
    .map((f, idx) => ({
      id: `col-${f.id}`,
      fieldId: f.id,
      labelOverride: f.name,
      visible: true,
      alignment: 'left',
      allowSorting: true,
      allowFiltering: true,
      position: idx,
    })),
  filters: [],
  sortBy: [],
  allowMultiSelect: true,
  allowPaging: true,
  recordsPerPage: 25,
  pagingMode: 'dynamic',
});

function parseConfig(layout: any): any {
  if (!layout) return null;
  let raw = layout.status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return raw;
}

export const ListViewEngine: React.FC<ListViewEngineProps> = ({
  tableName,
  layoutId,
  initialLayout,
  initialFields,
  related,
  title,
  menuPath,
  navigate,
  onRecordOpen,
  tableId,
  embedded = false,
  actionsBar = 'card',
  onActionsReady,
}) => {
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [fields, setFields] = useState<SailsFieldDefinition[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  /** Live aggregate values (sum/avg/min/max/count) for the Summary Panel. */
  const [aggregates, setAggregates] = useState<{ fieldName: string; aggregate: string; value: any }[] | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeSortRules, setRuntimeSortRules] = useState<RuntimeSortRule[]>([]);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, string>>({});
  const [activePreviewFilter, setActivePreviewFilter] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);
  const [appliedFilterGroups, setAppliedFilterGroups] = useState<FilterGroup[]>([]);
  const appliedFilterGroupsRef = useRef<FilterGroup[]>([]);

  // ── Inline edit / create state ──
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, any>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string[]>>({});
  const [savingRow, setSavingRow] = useState(false);
  const [creatingRow, setCreatingRow] = useState(false);
  const [createDraft, setCreateDraft] = useState<Record<string, any>>({});
  const [createErrors, setCreateErrors] = useState<Record<string, string[]>>({});
  const [savingCreate, setSavingCreate] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

  const initialLoadDone = useRef(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const tableNameRef = useRef<string | null>(null);
  const layoutConfigRef = useRef<any>(null);
  const fieldsRef = useRef<SailsFieldDefinition[]>([]);
  const detailLayoutMapRef = useRef<Map<string, string>>(new Map());
  const defaultDetailLayoutKeyRef = useRef<string>('');
  const relatedRef = useRef(related);
  relatedRef.current = related;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const runtimeFiltersRef = useRef(runtimeFilters);
  runtimeFiltersRef.current = runtimeFilters;
  const runtimeSortRulesRef = useRef(runtimeSortRules);
  runtimeSortRulesRef.current = runtimeSortRules;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const recordsPerPageRef = useRef(recordsPerPage);
  recordsPerPageRef.current = recordsPerPage;

  const doFetch = useCallback(async (pageOverride?: number) => {
    const tn = tableNameRef.current;
    if (!tn) return;

    const flds = fieldsRef.current;
    const findField = (idOrName: string) => flds.find((fd: any) => fd.id === idOrName || fd.fieldName === idOrName);

    const mergedFilters: Record<string, string> = {};
    const rf = runtimeFiltersRef.current;
    for (const [fieldId, value] of Object.entries(rf)) {
      if (!value?.trim()) continue;
      const field = findField(fieldId);
      if (!field) continue;
      mergedFilters[`${field.fieldName}:contains`] = value;
    }

    const page = pageOverride ?? currentPageRef.current;
    const limit = recordsPerPageRef.current;
    const params = new URLSearchParams();

    if (relatedRef.current) {
      // Related mode: the /related endpoint applies the view's own filters/sort
      // server-side; the engine only sends session filters + runtime sort.
      params.set('field', relatedRef.current.fieldName);
      params.set('parentId', relatedRef.current.parentRecordId);
      if (layoutId) params.set('viewId', layoutId);
      if (Object.keys(mergedFilters).length) params.set('filters', JSON.stringify(mergedFilters));
      const runtimeSort: { fieldId: string; dir: 'asc' | 'desc' }[] = [];
      for (const s of runtimeSortRulesRef.current) {
        const field = findField(s.fieldId);
        if (!field) continue;
        runtimeSort.push({ fieldId: field.fieldName, dir: s.direction });
      }
      if (runtimeSort.length) params.set('sort', JSON.stringify(runtimeSort));
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/dynamic/${tn}/related?${params}`);
      const data = await res.json();
      setRecords(data.rows || []);
      setTotalRecords(data.total || 0);
      if (data.fields && data.fields.length > 0) {
        fieldsRef.current = data.fields;
        setFields(data.fields);
      }
      if (pageOverride !== undefined) setCurrentPage(pageOverride);
      return;
    }

    // Page mode — full server-side pipeline (filters + filterGroups + sort).
    const lc = layoutConfigRef.current;
    const filterGroups = serializeFilterGroups(appliedFilterGroupsRef.current, (fieldId) => {
      const field = findField(fieldId);
      return field?.fieldName || null;
    });

    const mergedSort: { fieldId: string; dir: 'asc' | 'desc' }[] = [];
    const layoutSort = lc?.sortBy || [];
    for (const s of layoutSort) {
      const field = findField(s.fieldId || s.id);
      if (!field) continue;
      mergedSort.push({ fieldId: field.fieldName, dir: s.direction || 'asc' });
    }
    for (const s of runtimeSortRulesRef.current) {
      const field = findField(s.fieldId);
      if (!field) continue;
      mergedSort.push({ fieldId: field.fieldName, dir: s.direction || 'asc' });
    }

    if (Object.keys(mergedFilters).length) params.set('filters', JSON.stringify(mergedFilters));
    if (filterGroups.length) params.set('filterGroups', JSON.stringify(filterGroups));
    if (mergedSort.length) params.set('sort', JSON.stringify(mergedSort));
    const sq = searchQueryRef.current;
    if (sq?.trim()) params.set('search', sq.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));

    // Live aggregate summaries configured in the layout's Summary Panel.
    const summaryFields: { fieldId: string; aggregate?: string }[] = lc?.summaryFields || [];
    if (summaryFields.length > 0) {
      const aggPayload = summaryFields
        .map((sf) => ({ fieldId: sf.fieldId, aggregate: sf.aggregate || 'sum' }))
        .filter((a) => findField(a.fieldId));
      if (aggPayload.length > 0) params.set('aggregates', JSON.stringify(aggPayload));
    }

    const res = await fetch(`/api/dynamic/${tn}?${params}`);
    const data = await res.json();
    setRecords(data.rows || []);
    setTotalRecords(data.total || 0);
    setAggregates(data.aggregates || null);
    if (data.fields && data.fields.length > 0) {
      fieldsRef.current = data.fields;
      setFields(data.fields);
    }
    if (pageOverride !== undefined) setCurrentPage(pageOverride);
  }, [layoutId]);

  useEffect(() => {
    if (!tableName) {
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      setError(null);
      initialLoadDone.current = false;
      try {
        let targetLayout: any = initialLayout || null;
        let dataModelId = tableId || targetLayout?.tableId || null;

        if (!targetLayout && layoutId && layoutId !== '_default') {
          const byId = await fetchCached(`/api/console/layouts?id=${layoutId}`);
          if (byId.success) targetLayout = byId.data;
        }
        if (!dataModelId && targetLayout?.tableId) dataModelId = targetLayout.tableId;

        const lResult = dataModelId ? await fetchCached(`/api/console/layouts?tableId=${dataModelId}&page=1&limit=100`) : null;
        const rows: any[] = lResult?.data?.rows || [];
        const layoutMap = new Map<string, string>();
        for (const r of rows) {
          if (r.id && r.systemName) layoutMap.set(r.id, r.systemName);
        }
        detailLayoutMapRef.current = layoutMap;

        const detailRows = rows.filter((r: any) => r.viewType === 'DETAIL' || r.viewType === 'FORM');
        const defaultDetail =
          detailRows.find((r: any) => r.status === 'active' && r.isDefault) ||
          detailRows.find((r: any) => r.status === 'active') ||
          detailRows[0];
        defaultDetailLayoutKeyRef.current = defaultDetail?.systemName || '';

        if (!targetLayout && layoutId && layoutId !== '_default') {
          targetLayout = rows.find((r: any) => r.id === layoutId || r.systemName === layoutId) || null;
        }

        if (!targetLayout) {
          targetLayout =
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active' && r.isDefault) ||
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active') ||
            rows.find((r: any) => r.viewType === 'LIST') ||
            {
              id: 'default-synthetic-list',
              viewType: 'LIST',
              status: 'active',
              tableId: dataModelId || null,
              config: defaultSyntheticConfig(initialFields || []),
            };
        }

        const cfg = parseConfig(targetLayout);
        recordsPerPageRef.current = cfg?.recordsPerPage || 25;

        tableNameRef.current = tableName;
        if (initialFields && initialFields.length > 0) {
          fieldsRef.current = initialFields;
          setFields(initialFields);
        }
        layoutConfigRef.current = cfg;
        currentPageRef.current = 1;

        const initialGroups = normalizeFilters(cfg?.filters);
        appliedFilterGroupsRef.current = initialGroups;
        setAppliedFilterGroups(initialGroups);

        setRecordsPerPage(cfg?.recordsPerPage || 25);
        setLayout(targetLayout);

        // Perform a single, authoritative data fetch with the resolved configuration
        await doFetch(1);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    init();
  }, [tableName, layoutId, related?.parentRecordId, tableId, doFetch, initialLayout]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const t = setTimeout(() => doFetch(1), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doFetch]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const t = setTimeout(() => doFetch(1), 300);
    return () => clearTimeout(t);
  }, [runtimeFilters, doFetch]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const t = setTimeout(() => doFetch(1), 300);
    return () => clearTimeout(t);
  }, [appliedFilterGroups, doFetch]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    doFetch(1);
  }, [runtimeSortRules, doFetch]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    doFetch();
  }, [currentPage, doFetch]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    doFetch(1);
  }, [recordsPerPage, doFetch]);

  const config = useMemo(() => parseConfig(layout), [layout]);

  const configuredActions: ListAction[] = useMemo(() => {
    return (config?.actions || []).filter((a: ListAction) => a.visible);
  }, [config]);

  const editableFields = useMemo(
    () => fields.filter((f) => !isSystemField(f.fieldName)),
    [fields]
  );

  // ── Inline edit ──
  const startEdit = useCallback((rec: any) => {
    if (!rec?.id || creatingRow) return;
    const draft: Record<string, any> = {};
    for (const f of fieldsRef.current) {
      if (!isSystemField(f.fieldName)) draft[f.fieldName] = rec[f.fieldName] ?? '';
    }
    setEditDraft(draft);
    setEditErrors({});
    setFormError('');
    setConfirmDeleteId(null);
    setEditingRowId(rec.id);
  }, [creatingRow]);

  const updateEditCell = useCallback((fieldName: string, value: any) => {
    setEditDraft((d) => ({ ...d, [fieldName]: value }));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditDraft({});
    setEditErrors({});
    setFormError('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingRowId) return;
    const issues = validateRecord(fieldsRef.current, editDraft);
    if (issues.length > 0) {
      const errs: Record<string, string[]> = {};
      for (const i of issues) errs[i.fieldName] = [i.message];
      setEditErrors(errs);
      setFormError('');
      return;
    }
    setSavingRow(true);
    setFormError('');
    try {
      const res = await fetch(`/api/dynamic/${tableNameRef.current}?id=${editingRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizeWritePayload(fieldsRef.current, editDraft)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errs: Record<string, string[]> = {};
        for (const i of data.issues || []) errs[i.fieldName] = [i.message];
        if (Object.keys(errs).length > 0) setEditErrors(errs);
        else setFormError(data.error || 'Failed to update record.');
        return;
      }
      cancelEdit();
      doFetch();
    } catch {
      setFormError('Failed to update record.');
    } finally {
      setSavingRow(false);
    }
  }, [editingRowId, editDraft, cancelEdit, doFetch]);

  // ── Inline create ──
  const startCreate = useCallback(() => {
    if (creatingRow || editingRowId) return;
    const draft: Record<string, any> = {};
    for (const f of fieldsRef.current) {
      if (isSystemField(f.fieldName)) continue;
      // Auto-number is generated by the DB on insert — leave it out of the payload.
      if ((f.logicalType || '').toLowerCase() === 'auto_number') continue;
      draft[f.fieldName] = (f.config as any)?.defaultValue ?? '';
    }
    setCreateDraft(draft);
    setCreateErrors({});
    setFormError('');
    setConfirmDeleteId(null);
    setCreatingRow(true);
  }, [creatingRow, editingRowId]);

  const updateCreateCell = useCallback((fieldName: string, value: any) => {
    setCreateDraft((d) => ({ ...d, [fieldName]: value }));
  }, []);

  const cancelCreate = useCallback(() => {
    setCreatingRow(false);
    setCreateDraft({});
    setCreateErrors({});
    setFormError('');
  }, []);

  const saveCreate = useCallback(async () => {
    const payload = { ...createDraft };
    const rel = relatedRef.current;
    if (rel) payload[rel.fieldName] = rel.parentRecordId;

    const issues = validateRecord(fieldsRef.current, payload);
    if (issues.length > 0) {
      const errs: Record<string, string[]> = {};
      for (const i of issues) errs[i.fieldName] = [i.message];
      setCreateErrors(errs);
      setFormError('');
      return;
    }
    setSavingCreate(true);
    setFormError('');
    try {
      const res = await fetch(`/api/dynamic/${tableNameRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizeWritePayload(fieldsRef.current, payload)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errs: Record<string, string[]> = {};
        for (const i of data.issues || []) errs[i.fieldName] = [i.message];
        if (Object.keys(errs).length > 0) setCreateErrors(errs);
        else setFormError(data.error || 'Failed to create record.');
        return;
      }
      cancelCreate();
      doFetch(1);
    } catch {
      setFormError('Failed to create record.');
    } finally {
      setSavingCreate(false);
    }
  }, [createDraft, cancelCreate, doFetch]);

  // ── Inline delete (with confirmation) ──
  const requestDelete = useCallback((rec: any) => {
    if (!rec?.id || creatingRow || editingRowId) return;
    setFormError('');
    setConfirmDeleteId(rec.id);
  }, [creatingRow, editingRowId]);

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
    setFormError('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    setDeletingRow(true);
    setFormError('');
    try {
      const res = await fetch(`/api/dynamic/${tableNameRef.current}?id=${confirmDeleteId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'Failed to delete record.');
        return;
      }
      setConfirmDeleteId(null);
      doFetch();
    } catch {
      setFormError('Failed to delete record.');
    } finally {
      setDeletingRow(false);
    }
  }, [confirmDeleteId, doFetch]);

  // ── Actions ──
  const { pushRecord, recordsVersion } = useRecordStack();

  // Records changed in a stacked card (create/update/delete) — refresh the list.
  useEffect(() => {
    if (initialLoadDone.current) doFetch(1);
  }, [recordsVersion, doFetch]);

  const handleExecuteAction = useCallback((action: ListAction) => {
    // Create: inline row when the view allows it, otherwise a stacked new-record card.
    if (action.actionKey === 'create') {
      if (config?.allowInlineCreate) {
        startCreate();
        return;
      }
      const createLayoutKey = defaultDetailLayoutKeyRef.current;
      const tn = tableNameRef.current;
      const rel = relatedRef.current;
      // Standalone list page: navigate directly to the new-record route
      // instead of stacking the panel.
      if (!rel && navigateRef.current && createLayoutKey && tn && menuPath) {
        const base = menuPath.replace(/\/+$/, '');
        navigateRef.current(`${base}/${createLayoutKey}/new`);
        return;
      }
      if (createLayoutKey && tn) {
        // Bind the parent FK when the create originates from a Related List block.
        pushRecord({
          tableName: tn,
          layoutKey: createLayoutKey,
          recordId: 'new',
          preset: rel ? { [rel.fieldName]: rel.parentRecordId } : undefined,
        });
        return;
      }
      setFormError('No detail view is configured for this model yet.');
      return;
    }
    const registry = ActionRegistry.getInstance();
    const plugin = registry.getAction(action.actionKey);
    const dataModelId = tableId || layout?.tableId || '';
    if (plugin) {
      plugin.execute({
        tableId: dataModelId,
        tableName: tableNameRef.current || '',
        layoutId: layout?.id,
        menuPath,
        embedded: !!relatedRef.current,
        defaultDetailLayoutKey: defaultDetailLayoutKeyRef.current || undefined,
        navigate: navigateRef.current || ((_: string | number) => {}),
        refetch: () => doFetch(),
      });
    }
  }, [config, tableId, layout, menuPath, startCreate, doFetch, pushRecord]);

  // Hand the actions + executor to the parent (page-header placement when actionsBar='none').
  useEffect(() => {
    onActionsReady?.(configuredActions, handleExecuteAction);
  }, [configuredActions, handleExecuteAction, onActionsReady]);

  if (loading) {
    return embedded ? (
      <div className="ls-table-card" style={{ padding: 16 }}><p className="ls-empty">Loading…</p></div>
    ) : (
      <LoadingScreen />
    );
  }

  if (error) {
    return (
      <div className="sails-list-engine" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--sails-danger, #ef4444)' }}>
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  const mobileViewMode = config?.mobileViewMode as string || 'table';
  const showMobileView = mobileViewMode === 'accordion' || mobileViewMode === 'card';

  return (
    <div className={`sails-list-engine${embedded ? ' sails-list-engine--embedded' : ''}${creatingRow || editingRowId || activePreviewFilter ? ' sails-list-engine--inline-active' : ''}`}
      data-mobile-mode={showMobileView ? mobileViewMode : 'table'}
    >
      <div className={`sails-list-view-table-wrap ${showMobileView ? 'sails-list-view-table-wrap--has-mobile' : ''}`}>
        <ListViewTable
          mode="page"
          config={config}
          fields={fields}
          records={records}
          totalRecords={totalRecords}
          aggregates={aggregates}
          page={currentPage}
          onPageChange={setCurrentPage}
          recordsPerPage={recordsPerPage}
          onRecordsPerPageChange={setRecordsPerPage}
          sortRules={runtimeSortRules}
          onSortRulesChange={setRuntimeSortRules}
          runtimeFilters={runtimeFilters}
          onRuntimeFiltersChange={setRuntimeFilters}
          activePreviewFilter={activePreviewFilter}
          onActivePreviewFilterChange={setActivePreviewFilter}
          selectedIndices={selectedIndices}
          onSelectionChange={setSelectedIndices}
          onPrimaryLinkClick={(rec, col) => {
            const layoutKey =
              detailLayoutMapRef.current.get(col.targetDetailLayoutId || '') ||
              col.targetDetailLayoutId ||
              defaultDetailLayoutKeyRef.current;
            if (onRecordOpen) {
              onRecordOpen(rec, layoutKey || undefined);
              return;
            }
            const base = menuPath?.replace(/\/+$/, '');
            if (navigateRef.current && base && layoutKey) navigateRef.current(`${base}/${layoutKey}/${rec.id}`);
          }}
          allowInlineEdit={!!config?.allowInlineEdit}
          editingRowId={editingRowId}
          editDraft={editDraft}
          editErrors={editErrors}
          savingRow={savingRow}
          onStartEdit={startEdit}
          onCellChange={(fieldName, v) => {
            if (editingRowId) updateEditCell(fieldName, v);
            else updateCreateCell(fieldName, v);
          }}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
          creatingRow={creatingRow}
          createDraft={createDraft}
          createErrors={createErrors}
          savingCreate={savingCreate}
          onCreateSave={saveCreate}
          onCreateCancel={cancelCreate}
          formError={formError}
          allowInlineDelete={!!config?.allowInlineDelete}
          confirmDeleteId={confirmDeleteId}
          deletingRow={deletingRow}
          onRequestDelete={requestDelete}
          onCancelDelete={cancelDelete}
          onConfirmDelete={confirmDelete}
          header={
            <div className="ls-table-card__header">
              <Columns size={13} />
              <span className="ls-table-card__title">{title}</span>
              <span className="ls-table-card__badge" style={{ marginLeft: 'auto' }}>
                {totalRecords} rows
              </span>
              {(config?.allowMultiSelect ?? true) && selectedIndices.size > 0 && (
                <span className="ls-table-card__badge" style={{ background: 'rgba(157,206,224,0.25)', color: 'var(--sails-primary)' }}>
                  {selectedIndices.size} selected
                </span>
              )}
              {runtimeSortRules.length > 0 && (
                <button type="button" className="ls-block__btn" onClick={() => setRuntimeSortRules([])} title="Reset sort" style={{ marginLeft: 4 }}>
                  <RotateCcw size={11} />
                </button>
              )}
              <div className="dtp-filter-head" style={{ marginLeft: 8 }}>
                <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm dtp-filter-btn" title="Saved view filters">
                  <Filter size={12} /> Filters
                </button>
              </div>
              {actionsBar === 'card' && configuredActions.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                  {configuredActions.map((act) => {
                    const plugin = ActionRegistry.getInstance().getAction(act.actionKey);
                    const iconName = plugin?.iconName || (act.actionKey === 'create' ? 'Plus' : 'Zap');
                    const variant = act.variant || 'primary';
                    const variantClass = variant === 'primary' ? 'sails-btn--primary'
                      : variant === 'danger' ? 'sails-btn--danger'
                      : variant === 'secondary' ? 'sails-btn--secondary'
                      : 'sails-btn--ghost';
                    return (
                      <button key={act.id} type="button" className={`sails-btn ${variantClass} sails-btn--sm`} onClick={() => handleExecuteAction(act)}>
                        <DynamicIcon name={iconName} size={14} />
                        <span>{act.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          }
        />
      </div>
      {showMobileView && (
        <div className="sails-list-view-mobile-wrap">
          <ListViewMobile
            config={config}
            fields={fields}
            records={records}
            totalRecords={totalRecords}
            page={currentPage}
            onPageChange={setCurrentPage}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={setRecordsPerPage}
            sortRules={runtimeSortRules}
            onSortRulesChange={setRuntimeSortRules}
            runtimeFilters={runtimeFilters}
            onRuntimeFiltersChange={setRuntimeFilters}
            activePreviewFilter={activePreviewFilter}
            onActivePreviewFilterChange={setActivePreviewFilter}
            selectedIndices={selectedIndices}
            onSelectionChange={setSelectedIndices}
            onPrimaryLinkClick={(rec, col) => {
              const layoutKey =
                detailLayoutMapRef.current.get(col.targetDetailLayoutId || '') ||
                col.targetDetailLayoutId ||
                defaultDetailLayoutKeyRef.current;
              if (onRecordOpen) {
                onRecordOpen(rec, layoutKey || undefined);
                return;
              }
              const base = menuPath?.replace(/\/+$/, '');
              if (navigate && base && layoutKey) navigate(`${base}/${layoutKey}/${rec.id}`);
            }}
            title={title}
            allowInlineEdit={!!config?.allowInlineEdit}
            editingRowId={editingRowId}
            editDraft={editDraft}
            editErrors={editErrors}
            savingRow={savingRow}
            onStartEdit={startEdit}
            onCellChange={(fieldName, v) => {
              if (editingRowId) updateEditCell(fieldName, v);
              else updateCreateCell(fieldName, v);
            }}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            creatingRow={creatingRow}
            createDraft={createDraft}
            createErrors={createErrors}
            savingCreate={savingCreate}
            onCreateSave={saveCreate}
            onCreateCancel={cancelCreate}
            formError={formError}
            allowInlineDelete={!!config?.allowInlineDelete}
            confirmDeleteId={confirmDeleteId}
            deletingRow={deletingRow}
            onRequestDelete={requestDelete}
            onCancelDelete={cancelDelete}
            onConfirmDelete={confirmDelete}
            mobileViewMode={mobileViewMode as 'accordion' | 'card'}
            actions={configuredActions.map((act) => {
              const plugin = ActionRegistry.getInstance().getAction(act.actionKey);
              return {
                label: act.label,
                variant: act.variant || 'primary',
                iconName: plugin?.iconName || 'Plus',
                onClick: () => handleExecuteAction(act),
              };
            })}
          />
        </div>
      )}
    </div>
  );
};

export default ListViewEngine;
