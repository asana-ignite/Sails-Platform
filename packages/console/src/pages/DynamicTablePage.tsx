import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  Columns,
  Layers,
  Database,
  Plus,
  Search,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import type { ConsoleMenu, TableLayout, SailsFieldDefinition, ListAction } from '@sails/shared';
import { isSystemField, formatDateTimeValue, formatDecimalValue } from '@sails/shared';
import { useDateTimePrefs, isSystemDateTimeField, formatSystemDateTimeValue } from '../utils/systemDateTime';
import { UserControl, useTenantUsers } from '../features/controls/plugins/UserControl';
import { PhoneControl } from '../features/controls/plugins/PhoneControl';
import { EmailControl } from '../features/controls/plugins/EmailControl';
import { LatLngControl } from '../features/controls/plugins/LatLngControl';
import DynamicIcon from '../components/common/DynamicIcon';
import CustomSelect from '../components/common/CustomSelect';
import LoadingScreen from '../components/common/LoadingScreen';
import { fetchCached } from '../api/client';
import { ActionRegistry } from '../features/actions';
import '../features/controls/controls.css';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

function resolveLabel(col: any, fields: SailsFieldDefinition[]): string {
  const fd = fields.find((f) => f.id === col.fieldId || f.fieldName === col.fieldId);
  return col.labelOverride || fd?.name || col.fieldId;
}

const NUMERIC_COLUMN_TYPES = new Set(['number', 'decimal', 'currency', 'percentage', 'percent']);

function renderListFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
  const val = record[field.fieldName];
  if (val === undefined || val === null) return '\u2014';
  if (field.logicalType === 'currency') return `\u0E3F${formatDecimalValue(val, field.config, field.logicalType)}`;
  if (field.logicalType === 'percentage' || field.logicalType === 'percent') return `${formatDecimalValue(val, field.config, field.logicalType)}%`;
  if (field.logicalType === 'decimal' || field.logicalType === 'number') return formatDecimalValue(val, field.config, field.logicalType);
  if (field.logicalType === 'boolean') return val ? 'Yes' : 'No';
  if (field.logicalType === 'date' || field.logicalType === 'datetime' || field.logicalType === 'timestamp' || field.logicalType === 'time') {
    const formatted = formatDateTimeValue(val, field.config, field.logicalType);
    return formatted || '\u2014';
  }
  if (field.logicalType === 'select') {
    const options = (field.config as any)?.options || [];
    return options.find((o: any) => o.value === val)?.label || String(val);
  }
  if (field.logicalType === 'lat_lng' && typeof val === 'object' && val !== null) {
    return `${val.lat}, ${val.lng}`;
  }
  if (field.logicalType === 'address' && typeof val === 'object' && val !== null) {
    const parts = [
      val.address1,
      val.address2,
      [val.city, val.state].filter((p: any) => typeof p === 'string' && p.trim() !== '').join(', '),
      val.country,
      val.postalCode,
    ].filter((p: any) => typeof p === 'string' && p.trim() !== '');
    return parts.length > 0 ? parts.join(', ') : JSON.stringify(val);
  }
  return String(val);
}

const LIST_PER_PAGE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

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
    const layoutFilters = lc?.filters || [];
    for (const f of layoutFilters) {
      const field = findField(f.fieldId || f.id);
      if (!field) continue;
      const op = f.operator && f.operator !== 'eq' ? `:${f.operator}` : '';
      mergedFilters[`${field.fieldName}${op}`] = f.value;
    }
    const rf = runtimeFiltersRef.current;
    for (const [fieldId, value] of Object.entries(rf)) {
      if (!value?.trim()) continue;
      const field = findField(fieldId);
      if (!field) continue;
      mergedFilters[`${field.fieldName}:contains`] = value;
    }

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

  const allowMultiSelect = config?.allowMultiSelect ?? true;
  const allowPaging = config?.allowPaging ?? true;
  const pagingMode = config?.pagingMode || 'dynamic';

  const rawCols = useMemo(() => {
    if (config?.columns && config.columns.length > 0) return config.columns;
    return fields
      .filter((f) => !isSystemField(f.fieldName))
      .map((f, idx) => ({
        id: `col-${f.id}`,
        fieldId: f.id,
        labelOverride: f.name,
        visible: true,
        alignment: 'left',
        allowSorting: true,
        allowFiltering: true,
        position: idx
      }));
  }, [config, fields]);

  const sortedListColumns = useMemo(() => {
    return [...rawCols].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  }, [rawCols]);

  const visibleListColumns = useMemo(() => {
    return sortedListColumns.filter((c: any) => c.visible !== false);
  }, [sortedListColumns]);

  const listRuntimeRecords = useMemo(() => records, [records]);

  const totalPages = useMemo(() => {
    if (!allowPaging) return 1;
    return Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  }, [allowPaging, totalRecords, recordsPerPage]);

  const safeCurrentPage = useMemo(() => {
    return Math.max(1, Math.min(currentPage, totalPages));
  }, [currentPage, totalPages]);

  const csvExportData = useMemo(() => {
    const headers = visibleListColumns.map((col: any) => resolveLabel(col, fields));
    const rows = records.map((rec) =>
      visibleListColumns.map((col: any) => {
        const f = fields.find((ff: any) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
        if (!f) return rec[col.fieldId] !== undefined ? String(rec[col.fieldId]) : '';
        if (isSystemDateTimeField(f)) return formatSystemDateTimeValue(rec[f.fieldName] ?? rec[f.id], datetimePrefs);
        if (f.logicalType === 'user') return userDisplayName(rec[f.fieldName] ?? rec[f.id]);
        return renderListFieldValue(f, rec);
      })
    );
    return { headers, rows };
  }, [visibleListColumns, fields, records]);

  const currentPageRecords = useMemo(() => records, [records]);

  const allSelectedOnPage = useMemo(() => {
    if (currentPageRecords.length === 0) return false;
    return currentPageRecords.every((_, i) => selectedIndices.has(i));
  }, [currentPageRecords, selectedIndices]);

  const pageNumbers = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1) {
        if (items.length > 0 && p - (items[items.length - 1] as number) > 1) items.push('ellipsis');
        items.push(p);
      }
    }
    return items;
  }, [totalPages, safeCurrentPage]);

  const handleRuntimeSort = (columnId: string) => {
    const col = visibleListColumns.find((c: any) => c.id === columnId);
    if (!col) return;
    const fieldId = col.fieldId;
    setRuntimeSortRules((prev) => {
      const idx = prev.findIndex((r) => r.fieldId === fieldId);
      if (idx === -1) return [...prev, { fieldId, direction: 'asc' }];
      if (prev[idx].direction === 'asc') {
        const next = [...prev];
        next[idx] = { fieldId, direction: 'desc' };
        return next;
      }
      return prev.filter((r) => r.fieldId !== fieldId);
    });
  };

  const handleRuntimeFilter = (fieldId: string, value: string) => {
    setRuntimeFilters((prev) => ({ ...prev, [fieldId]: value }));
  };

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIndices(new Set());
    } else {
      const next = new Set<number>();
      currentPageRecords.forEach((_, i) => next.add(i));
      setSelectedIndices(next);
    }
  };

  const toggleSelectRecord = (globalIdx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(globalIdx)) next.delete(globalIdx);
      else next.add(globalIdx);
      return next;
    });
  };



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
        <div className="ls-table-card">
          <div className="ls-table-card__header">
            <Columns size={13} />
            <span className="ls-table-card__title">{displayTitle}</span>
            <span className="ls-table-card__badge" style={{ marginLeft: 'auto' }}>
              {totalRecords} rows
            </span>
            {allowMultiSelect && selectedIndices.size > 0 && (
              <span className="ls-table-card__badge" style={{ background: 'rgba(157,206,224,0.25)', color: 'var(--sails-primary)' }}>
                {selectedIndices.size} selected
              </span>
            )}
            {runtimeSortRules.length > 0 && (
              <button className="ls-block__btn" onClick={() => setRuntimeSortRules([])} title="Reset sort" style={{ marginLeft: 4 }}>
                <RotateCcw size={11} />
              </button>
            )}
          </div>

          <div className="ls-table-card__body" style={{ padding: 0 }}>
            {visibleListColumns.length === 0 ? (
              <div style={{ padding: 16 }}><p className="ls-empty">No columns visible in this list view configuration.</p></div>
            ) : (
              <div className="ls-preview-wrap">
                <table className="ls-runtime-table">
                  <thead>
                    <tr>
                      {allowMultiSelect && (
                        <th className="ls-rth ls-rth--cb" style={{ width: 40, minWidth: 40 }}>
                          <div className="ls-rth__inner" style={{ justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={currentPageRecords.length > 0 && allSelectedOnPage}
                              ref={(el) => { if (el) el.indeterminate = !allSelectedOnPage && currentPageRecords.some((_, i) => selectedIndices.has(i)); }}
                              onChange={toggleSelectAll}
                              title="Select all on page"
                            />
                          </div>
                        </th>
                      )}
                      {visibleListColumns.map((col: any) => {
                        const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                        const label = resolveLabel(col, fields);
                        const runtimeSortIdx = runtimeSortRules.findIndex((r) => r.fieldId === col.fieldId || (f && r.fieldId === f.id));
                        const isSorted = runtimeSortIdx !== -1;
                        const sortDir = isSorted ? runtimeSortRules[runtimeSortIdx].direction : null;
                        const isFiltering = !!(col.fieldId && runtimeFilters[col.fieldId]?.trim());
                        return (
                          <th
                            key={col.id}
                            className={`ls-rth ${col.allowSorting !== false ? 'ls-rth--sortable' : ''} ${isSorted ? 'ls-rth--sorted' : ''}`}
                            style={{ ...(col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : {}), textAlign: col.alignment || (f && NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}
                          >
                            <div className="ls-rth__inner">
                              {col.allowSorting !== false ? (
                                <button className="ls-rth__sort-btn" onClick={() => handleRuntimeSort(col.id)}>
                                  <span className="ls-rth__label">{label}</span>
                                  <span className="ls-rth__sort-indicator">
                                    {isSorted ? (
                                      sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                    ) : (
                                      <ArrowUpDown size={11} className="ls-rth__sort-icon" />
                                    )}
                                  </span>
                                </button>
                              ) : (
                                <span className="ls-rth__label">{label}</span>
                              )}
                              {col.allowFiltering !== false && (
                                <div className="ls-rth__filter-wrap">
                                  <button
                                    className={`ls-rth__filter-btn ${isFiltering ? 'ls-rth__filter-btn--active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActivePreviewFilter(activePreviewFilter === col.fieldId ? null : col.fieldId);
                                    }}
                                    title="Filter this column"
                                  >
                                    <Search size={11} />
                                  </button>
                                  {activePreviewFilter === col.fieldId && (
                                    <div className="ls-rth__filter-popover" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        className="sails-input"
                                        value={runtimeFilters[col.fieldId] || ''}
                                        onChange={(e) => handleRuntimeFilter(col.fieldId, e.target.value)}
                                        placeholder={`Filter ${label}...`}
                                        autoFocus
                                        style={{ fontSize: 12, padding: '5px 8px', width: 180 }}
                                      />
                                      {runtimeFilters[col.fieldId]?.trim() && (
                                        <button
                                          className="ls-rth__filter-clear"
                                          onClick={() => {
                                            handleRuntimeFilter(col.fieldId, '');
                                            setActivePreviewFilter(null);
                                          }}
                                        >
                                          <X size={12} /> Clear
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageRecords.map((rec, ri) => {
                      const globalIndex = ri;
                      return (
                        <tr key={rec.id || ri} className={`ls-rtd-row ${selectedIndices.has(globalIndex) ? 'ls-rtd-row--selected' : ''}`}>
                          {allowMultiSelect && (
                            <td className="ls-rtd ls-rtd--cb" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIndices.has(globalIndex)}
                                onChange={() => toggleSelectRecord(globalIndex)}
                              />
                            </td>
                          )}
                          {(() => {
                            const primaryColId = visibleListColumns.find((c: any) => c.isPrimaryLink)?.id || visibleListColumns[0]?.id;
                            return visibleListColumns.map((col: any) => {
                              const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                              const val = f ? rec[f.fieldName] : rec[col.fieldId];
                              const isPrimary = col.id === primaryColId;
                              const isUserColumn = !!f && f.logicalType === 'user';
                              const isPhoneColumn = !!f && f.logicalType === 'phone';
                              const isEmailColumn = !!f && f.logicalType === 'email';
                              const isLatLngColumn = !!f && f.logicalType === 'lat_lng';
                              const cellText = f
                                ? isSystemDateTimeField(f)
                                  ? formatSystemDateTimeValue(rec[f.fieldName] ?? rec[f.id], datetimePrefs)
                                  : isUserColumn
                                    ? userDisplayName(rec[f.fieldName] ?? rec[f.id])
                                    : renderListFieldValue(f, rec)
                                : (val !== undefined && val !== null ? String(val) : '—');
                              const cellNode = isUserColumn
                                ? <UserControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />
                                : isPhoneColumn
                                  ? <PhoneControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />
                                  : isEmailColumn
                                    ? <EmailControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />
                                    : isLatLngColumn
                                      ? <LatLngControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />
                                      : cellText;

                              return (
                                <td
                                  key={col.id}
                                  className={`ls-rtd ${col.wrapText ? 'ls-rtd--wrap' : ''} ${isPrimary ? 'ls-rtd--primary' : ''}`}
                                  style={{ textAlign: col.alignment || (f && NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}
                                >
                                  {isPrimary ? (
                                    <a
                                      href={`#record-${rec.id}`}
                                      className="ls-primary-link"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const menuPath = activeMenu?.path?.replace(/\/+$/, '');
                                        const layoutKey =
                                          detailLayoutMapRef.current.get(col.targetDetailLayoutId || '') ||
                                          col.targetDetailLayoutId ||
                                          defaultDetailLayoutKeyRef.current;
                                        if (menuPath && layoutKey) {
                                          navigate(`${menuPath}/${layoutKey}/${rec.id}`);
                                        }
                                      }}
                                      title={`View detail for ${cellText}`}
                                    >
                                      {cellText}
                                    </a>
                                  ) : (
                                    cellNode
                                  )}
                                </td>
                              );
                            });
                          })()}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {totalRecords === 0 && (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <p className="ls-empty">No records found.</p>
                  </div>
                )}

                {allowPaging && totalRecords > 0 && (
                  <div className="ls-pagination">
                    <div className="ls-pagination__info">
                      <span className="ls-pagination__range">
                        Showing <strong>{(safeCurrentPage - 1) * recordsPerPage + 1}</strong> to <strong>{Math.min(safeCurrentPage * recordsPerPage, totalRecords)}</strong> of <strong>{totalRecords}</strong>
                      </span>
                      {pagingMode === 'dynamic' && (
                        <div className="ls-pagination__page-size">
                          <span className="ls-pagination__page-size-label">Records per page:</span>
                          <CustomSelect
                            value={recordsPerPage}
                            options={LIST_PER_PAGE_OPTIONS}
                            onChange={(v: number) => { setRecordsPerPage(v); }}
                            size="sm"
                            direction="up"
                          />
                        </div>
                      )}
                    </div>
                    <div className="ls-pagination__controls">
                      <button
                        className="ls-pagination__btn"
                        disabled={safeCurrentPage <= 1}
                        onClick={() => setCurrentPage(safeCurrentPage - 1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {pageNumbers.map((p, i) =>
                        p === 'ellipsis' ? (
                          <span key={`e-${i}`} className="ls-pagination__ellipsis">...</span>
                        ) : safeCurrentPage === p ? (
                          <span key={p} className="ls-pagination-page ls-pagination-page--active">{p}</span>
                        ) : (
                          <button key={p} className="ls-pagination-page ls-pagination-page--clickable" onClick={() => setCurrentPage(p)}>{p}</button>
                        )
                      )}
                      <button
                        className="ls-pagination__btn"
                        disabled={safeCurrentPage >= totalPages}
                        onClick={() => setCurrentPage(safeCurrentPage + 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DynamicTablePage;
