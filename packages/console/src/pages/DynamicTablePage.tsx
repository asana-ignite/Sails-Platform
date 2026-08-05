import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  Columns,
  Layers,
  Database,
  AlertCircle,
  RotateCcw,
  Filter,
} from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import type { ConsoleMenu, TableLayout, SailsFieldDefinition, ListAction, FilterGroup } from '@sails/shared';
import { isSystemField, normalizeFilters, serializeFilterGroups } from '@sails/shared';
import { useDateTimePrefs, isSystemDateTimeField, formatSystemDateTimeValue } from '../utils/systemDateTime';
import { useTenantUsers } from '../features/controls/plugins/UserControl';
import { ListViewTable, renderListFieldValue, getVisibleColumns, resolveLabel } from '../components/list/ListViewTable';
import DynamicIcon from '../components/common/DynamicIcon';
import LoadingScreen from '../components/common/LoadingScreen';
import { fetchCached } from '../api/client';
import { ActionRegistry } from '../features/actions';
import '../features/controls/controls.css';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

const DynamicTablePage: React.FC = () => {
  const { apps, navigationItems } = useConsole();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const animClass = navigationType === 'POP' ? 'sails-dynamic-table--back' : '';

  const normalizePath = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  const findMenu = (menus: ConsoleMenu[]): ConsoleMenu | null => {
    const target = normalizePath(location.pathname);
    for (const menu of menus) {
      if (normalizePath(menu.path) === target) return menu;
      if (menu.children) {
        const found = findMenu(menu.children);
        if (found) return found;
      }
    }
    return null;
  };

  let activeMenu = findMenu(navigationItems);
  if (!activeMenu && apps) {
    for (const app of apps) {
      const found = findMenu(app.menus || []);
      if (found) {
        activeMenu = found;
        break;
      }
    }
  }

  const displayTitle = activeMenu?.label || 'Data Table';
  const iconName = activeMenu?.icon || 'Database';

  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [fields, setFields] = useState<SailsFieldDefinition[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Runtime interactive preview state
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeSortRules, setRuntimeSortRules] = useState<{ fieldId: string; direction: 'asc' | 'desc' }[]>([]);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, string>>({});
  const [activePreviewFilter, setActivePreviewFilter] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);

  // Saved layout filter state (session runtime, initialized from the layout config)
  const [appliedFilterGroups, setAppliedFilterGroups] = useState<FilterGroup[]>([]);
  const appliedFilterGroupsRef = useRef<FilterGroup[]>([]);

  const datetimePrefs = useDateTimePrefs();
  const { users: tenantUsers } = useTenantUsers();

  /** Resolve a user field value (ID) to a display name; falls back to the raw value. */
  const userDisplayName = useCallback((value: any): string => {
    if (typeof value === 'object' && value) return value?.name || value?.email || value?.id || '';
    const str = String(value ?? '').trim();
    if (!str) return '';
    const u = tenantUsers.find((x) => x.id === str || x.name === str || x.email === str);
    return u?.name || str;
  }, [tenantUsers]);

  const configuredActions: ListAction[] = useMemo(() => {
    if (!layout) return [];
    const cfg = layout.status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
    const parsed = typeof cfg === 'string' ? (typeof cfg === 'object' ? cfg : JSON.parse(cfg)) : cfg;
    return (parsed?.actions || []).filter((a: ListAction) => a.visible);
  }, [layout]);

  const initialLoadDone = useRef(false);
  const tableNameRef = useRef<string | null>(null);
  const layoutConfigRef = useRef<any>(null);
  const fieldsRef = useRef<SailsFieldDefinition[]>([]);
  const detailLayoutMapRef = useRef<Map<string, string>>(new Map());
  const defaultDetailLayoutKeyRef = useRef<string>('');
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

    const lc = layoutConfigRef.current;
    const flds = fieldsRef.current;

    const findField = (idOrName: string) =>
      flds.find((fd: any) => fd.id === idOrName || fd.fieldName === idOrName);

    const mergedFilters: Record<string, string> = {};
    const rf = runtimeFiltersRef.current;
    for (const [fieldId, value] of Object.entries(rf)) {
      if (!value?.trim()) continue;
      const field = findField(fieldId);
      if (!field) continue;
      mergedFilters[`${field.fieldName}:contains`] = value;
    }

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

    const params = new URLSearchParams();
    if (Object.keys(mergedFilters).length) params.set('filters', JSON.stringify(mergedFilters));
    if (filterGroups.length) params.set('filterGroups', JSON.stringify(filterGroups));
    if (mergedSort.length) params.set('sort', JSON.stringify(mergedSort));
    const sq = searchQueryRef.current;
    if (sq?.trim()) params.set('search', sq.trim());
    const page = pageOverride ?? currentPageRef.current;
    const limit = recordsPerPageRef.current;
    params.set('page', String(page));
    params.set('limit', String(limit));

    const res = await fetch(`/api/dynamic/${tn}?${params}`);
    const data = await res.json();

    setRecords(data.rows || []);
    setTotalRecords(data.total || 0);
    if (pageOverride !== undefined) setCurrentPage(pageOverride);
  }, []);

  useEffect(() => {
    if (!activeMenu?.dataModelId && !activeMenu?.listViewId) {
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      setError(null);
      initialLoadDone.current = false;
      try {
        let targetLayout: any = null;
        let dataModelId = activeMenu?.dataModelId || null;

        // Menu may only reference the list view layout — resolve the table from it.
        if (!dataModelId && activeMenu?.listViewId) {
          const byId = await fetchCached(`/api/console/layouts?id=${activeMenu.listViewId}`);
          if (byId.success) targetLayout = byId.data;
          dataModelId = targetLayout?.tableId || null;
        }

        // All layouts for this table — powers list layout selection, record detail
        // links (layout id -> system_name) and the default detail layout key.
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

        const listViewId = activeMenu?.listViewId;
        if (!targetLayout && listViewId) {
          targetLayout = rows.find((r: any) => r.id === listViewId || r.systemName === listViewId) || null;
        }
        if (!targetLayout) {
          targetLayout =
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active' && r.isDefault) ||
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active') ||
            rows.find((r: any) => r.viewType === 'LIST' && r.isDefault) ||
            rows.find((r: any) => r.viewType === 'LIST');
        }

        let tableName: string | null = targetLayout?.table?.tableName || null;

        if (!tableName) {
          const objectsData = await fetchCached('/api/metadata/objects', undefined, 60000);
          const objectRows = Array.isArray(objectsData) ? objectsData : (objectsData?.rows || objectsData?.data || []);
          if (dataModelId) {
            const foundTable = objectRows.find((t: any) => t.id === dataModelId || t.tableName === dataModelId);
            if (foundTable) tableName = foundTable.tableName;
          }
        }

        if (!tableName) {
          setError('Data model table reference not found');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', '25');

        const recordsRes = await fetch(`/api/dynamic/${tableName}?${params}`);
        if (!recordsRes.ok) {
          const errData = await recordsRes.json().catch(() => ({}));
          setError(errData.error || 'Failed to load records');
          return;
        }
        const recordsData = await recordsRes.json();

        const tableFields: SailsFieldDefinition[] = recordsData.fields || [];

        if (!targetLayout) {
          const displayableFields = tableFields.filter((f) => !isSystemField(f.fieldName));
          targetLayout = {
            id: 'default-synthetic-list',
            viewType: 'LIST',
            status: 'active',
            tableId: dataModelId,
            config: {
              columns: displayableFields.map((f, idx) => ({
                id: `col-${f.id}`,
                fieldId: f.id,
                labelOverride: f.name,
                visible: true,
                alignment: 'left',
                allowSorting: true,
                allowFiltering: true,
                position: idx
              })),
              filters: [],
              sortBy: [],
              allowMultiSelect: true,
              allowPaging: true,
              recordsPerPage: 25,
              pagingMode: 'dynamic'
            }
          };
        }

        const cfg = targetLayout.status === 'active' ? (targetLayout.publishedConfig || targetLayout.config) : targetLayout.config;
        if (cfg?.recordsPerPage) {
          recordsPerPageRef.current = cfg.recordsPerPage;
        }

        tableNameRef.current = tableName;
        fieldsRef.current = tableFields;
        layoutConfigRef.current = cfg;
        currentPageRef.current = 1;

        const initialGroups = normalizeFilters(cfg?.filters);
        appliedFilterGroupsRef.current = initialGroups;
        setAppliedFilterGroups(initialGroups);

        setRecordsPerPage(cfg?.recordsPerPage || 25);
        setFields(tableFields);
        setLayout(targetLayout);

        await doFetch(1);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    init();
  }, [activeMenu?.dataModelId, activeMenu?.listViewId, location.pathname, doFetch]);

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

  const config = useMemo(() => {
    if (!layout) return null;
    let raw = layout.status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (e) {}
    }
    return raw;
  }, [layout]);

  const csvExportData = useMemo(() => {
    const cols = getVisibleColumns(config, fields);
    const headers = cols.map((col: any) => resolveLabel(col, fields));
    const rows = records.map((rec) =>
      cols.map((col: any) => {
        const f = fields.find((ff: any) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
        if (!f) return rec[col.fieldId] !== undefined ? String(rec[col.fieldId]) : '';
        if (isSystemDateTimeField(f)) return formatSystemDateTimeValue(rec[f.fieldName] ?? rec[f.id], datetimePrefs);
        if (f.logicalType === 'user') return userDisplayName(rec[f.fieldName] ?? rec[f.id]);
        return renderListFieldValue(f, rec);
      })
    );
    return { headers, rows };
  }, [config, fields, records]);

  if (!activeMenu?.dataModelId && !activeMenu?.listViewId) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <div className="sails-page-header__icon-wrapper">
              <DynamicIcon name={iconName} size={24} />
            </div>
            <div>
              <h1 className="sails-page-header__title">{displayTitle}</h1>
              <p className="sails-page-header__subtitle">No data model linked to this navigation item.</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <div className="sails-page-header__icon-wrapper">
              <AlertCircle size={24} />
            </div>
            <div>
              <h1 className="sails-page-header__title">{displayTitle}</h1>
              <p className="sails-page-header__subtitle">{error}</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <div className="sails-page-header__icon-wrapper">
              <Database size={24} />
            </div>
            <div>
              <h1 className="sails-page-header__title">{displayTitle}</h1>
              <p className="sails-page-header__subtitle">Managing all records for the {displayTitle.toLowerCase()} entity.</p>
            </div>
          </div>
        </header>
        <section className="sails-dynamic-table__content">
          <div className="sails-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--sails-text-muted)' }}>
            <Layers size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3>No List View Configured</h3>
            <p>This data model doesn't have a default List View yet. Go to Layouts to create one.</p>
          </div>
        </section>
      </div>
    );
  }



  const handleExecuteAction = (action: ListAction) => {
    const registry = ActionRegistry.getInstance();
    const plugin = registry.getAction(action.actionKey);
    const dataModelId = activeMenu?.dataModelId || layout?.tableId || '';
    if (plugin) {
      plugin.execute({
        tableId: dataModelId,
        tableName: tableNameRef.current || '',
        layoutId: layout?.id,
        menuPath: activeMenu?.path || undefined,
        defaultDetailLayoutKey: defaultDetailLayoutKeyRef.current || undefined,
        navigate,
        refetch: () => doFetch(),
      });
    } else if (action.actionKey === 'create') {
      const menuPath = activeMenu?.path?.replace(/\/+$/, '');
      const createLayoutKey = defaultDetailLayoutKeyRef.current;
      navigate(menuPath && createLayoutKey ? `${menuPath}/${createLayoutKey}/new` : (menuPath || '/'));
    }
  };

  return (
    <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
      <header className="sails-page-header sails-dynamic-table__header">
        <div className="sails-page-header__left">
          <div className="sails-page-header__icon-wrapper">
            <DynamicIcon name={iconName} size={24} />
          </div>
          <div>
            <h1 className="sails-page-header__title">{displayTitle}</h1>
            <p className="sails-page-header__subtitle">Managing all records for the {displayTitle.toLowerCase()} entity.</p>
          </div>
        </div>
        <div className="sails-page-header__right">
          {configuredActions.map((act) => {
            const plugin = ActionRegistry.getInstance().getAction(act.actionKey);
            const iconName = plugin?.iconName || (act.actionKey === 'create' ? 'Plus' : 'Zap');
            const variant = act.variant || 'primary';
            const variantClass = variant === 'primary' ? 'sails-btn--primary' :
                                 variant === 'danger' ? 'sails-btn--danger' :
                                 variant === 'secondary' ? 'sails-btn--secondary' :
                                 'sails-btn--ghost';
            return (
              <button key={act.id} className={`sails-btn ${variantClass}`}
                onClick={() => handleExecuteAction(act)}>
                <DynamicIcon name={iconName} size={18} />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Layout Studio Preview Mode Runtime Table ── */}
      <section className="sails-dynamic-table__content">
        <ListViewTable
          mode="page"
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
            const menuPath = activeMenu?.path?.replace(/\/+$/, '');
            const layoutKey =
              detailLayoutMapRef.current.get(col.targetDetailLayoutId || '') ||
              col.targetDetailLayoutId ||
              defaultDetailLayoutKeyRef.current;
            if (menuPath && layoutKey) {
              navigate(`${menuPath}/${layoutKey}/${rec.id}`);
            }
          }}
          header={
            <div className="ls-table-card__header">
              <Columns size={13} />
              <span className="ls-table-card__title">{displayTitle}</span>
              <span className="ls-table-card__badge" style={{ marginLeft: 'auto' }}>
                {totalRecords} rows
              </span>
              {(config?.allowMultiSelect ?? true) && selectedIndices.size > 0 && (
                <span className="ls-table-card__badge" style={{ background: 'rgba(157,206,224,0.25)', color: 'var(--sails-primary)' }}>
                  {selectedIndices.size} selected
                </span>
              )}
              {runtimeSortRules.length > 0 && (
                <button className="ls-block__btn" onClick={() => setRuntimeSortRules([])} title="Reset sort" style={{ marginLeft: 4 }}>
                  <RotateCcw size={11} />
                </button>
              )}
              <div className="dtp-filter-head" style={{ marginLeft: 8 }}>
                <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm dtp-filter-btn" title="Saved view filters">
                  <Filter size={12} /> Filters
                </button>
              </div>
            </div>
          }
        />
      </section>
    </div>
  );
};

export default DynamicTablePage;
