import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import type { ConsoleMenu, TableLayout, SailsFieldDefinition } from '@sails/shared';
import DynamicIcon from '../components/common/DynamicIcon';
import CustomSelect from '../components/common/CustomSelect';
import LoadingScreen from '../components/common/LoadingScreen';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';

function resolveLabel(col: any, fields: SailsFieldDefinition[]): string {
  const fd = fields.find((f) => f.id === col.fieldId || f.fieldName === col.fieldId);
  return col.labelOverride || fd?.name || col.fieldId;
}

function applyLayoutFilters(
  records: any[],
  config: any,
  fields: SailsFieldDefinition[],
): any[] {
  const filters: any[] = config?.filters || [];
  if (filters.length === 0) return records;

  return records.filter((rec) => {
    return filters.every((filter: any) => {
      const fd = fields.find((f) => f.id === filter.fieldId || f.fieldName === filter.fieldId);
      const val = fd ? rec[fd.fieldName] : rec[filter.fieldId];
      const cmp = filter.value;
      switch (filter.operator) {
        case 'eq': return String(val ?? '') === String(cmp ?? '');
        case 'neq': return String(val ?? '') !== String(cmp ?? '');
        case 'contains': return String(val ?? '').toLowerCase().includes(String(cmp ?? '').toLowerCase());
        case 'is_empty': return val === undefined || val === null || String(val).trim() === '';
        case 'is_not_empty': return val !== undefined && val !== null && String(val).trim() !== '';
        case 'gt': return Number(val) > Number(cmp);
        case 'gte': return Number(val) >= Number(cmp);
        case 'lt': return Number(val) < Number(cmp);
        case 'lte': return Number(val) <= Number(cmp);
        default: return true;
      }
    });
  });
}

function applyLayoutSort(
  records: any[],
  config: any,
  fields: SailsFieldDefinition[],
): any[] {
  const sortRules: any[] = config?.sortBy || [];
  if (sortRules.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const rule of sortRules) {
      const fd = fields.find((f) => f.id === rule.fieldId || f.fieldName === rule.fieldId);
      const av = fd ? a[fd.fieldName] : a[rule.fieldId];
      const bv = fd ? b[fd.fieldName] : b[rule.fieldId];
      if (av == null && bv == null) continue;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

function renderListFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
  const val = record[field.fieldName];
  if (val === undefined || val === null) return '\u2014';
  if (field.logicalType === 'currency') return `\u0E3F${Number(val).toLocaleString()}`;
  if (field.logicalType === 'boolean') return val ? 'Yes' : 'No';
  if (field.logicalType === 'select') {
    const options = (field.config as any)?.options || [];
    return options.find((o: any) => o.value === val)?.label || String(val);
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
  const [error, setError] = useState<string | null>(null);

  // Runtime interactive preview state
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeSortRules, setRuntimeSortRules] = useState<{ fieldId: string; direction: 'asc' | 'desc' }[]>([]);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, string>>({});
  const [activePreviewFilter, setActivePreviewFilter] = useState<string | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(25);

  useEffect(() => {
    if (!activeMenu?.dataModelId && !activeMenu?.listViewId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        let targetLayout: any = null;

        const searchParams = new URLSearchParams(window.location.search);
        const targetLayoutId = searchParams.get('layoutId') || activeMenu?.listViewId;

        const [layoutRes, objRes] = await Promise.all([
          targetLayoutId ? fetch(`/api/console/layouts?id=${targetLayoutId}`) : Promise.resolve(null),
          fetch('/api/metadata/objects')
        ]);

        if (layoutRes && layoutRes.ok) {
          const layoutResult = await layoutRes.json();
          if (layoutResult.success) targetLayout = layoutResult.data;
        }

        const objectsData = objRes && objRes.ok ? await objRes.json() : [];
        const objectRows = Array.isArray(objectsData) ? objectsData : (objectsData.rows || objectsData.data || []);

        const dataModelId = activeMenu?.dataModelId || targetLayout?.tableId;

        if (!targetLayout && dataModelId) {
          const lRes = await fetch(`/api/console/layouts?tableId=${dataModelId}`);
          if (lRes.ok) {
            const lResult = await lRes.json();
            const rows: any[] = lResult.data?.rows || [];
            targetLayout =
              rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active' && r.isDefault) ||
              rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active') ||
              rows.find((r: any) => r.viewType === 'LIST' && r.isDefault) ||
              rows.find((r: any) => r.viewType === 'LIST');
          }
        }

        let tableName = targetLayout?.table?.tableName;
        if (!tableName && dataModelId) {
          const foundTable = objectRows.find((t: any) => t.id === dataModelId || t.tableName === dataModelId);
          if (foundTable) tableName = foundTable.tableName;
        }

        if (!tableName) {
          setError('Data model table reference not found');
          setLoading(false);
          return;
        }

        // Parallel fetch schema fields and records data concurrently
        const [metaRes, recordsRes] = await Promise.all([
          fetch(`/api/metadata/${tableName}`),
          fetch(`/api/dynamic/${tableName}`)
        ]);

        let tableFields: SailsFieldDefinition[] = [];
        if (metaRes.ok) {
          const tableMeta = await metaRes.json();
          tableFields = tableMeta.fields || [];
          setFields(tableFields);
        }

        if (!recordsRes.ok) {
          const errData = await recordsRes.json().catch(() => ({}));
          setError(errData.error || 'Failed to load records');
          return;
        }
        const recordsData = await recordsRes.json();
        setRecords(Array.isArray(recordsData) ? recordsData : []);

        // If layout doesn't exist, create default layout excluding internal system fields
        if (!targetLayout) {
          const displayableFields = tableFields.filter(
            (f) => !['is_active', 'is_system', 'tenant_id', 'owner_id'].includes(f.fieldName.toLowerCase())
          );
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

        setLayout(targetLayout);

        const cfg = targetLayout.status === 'active' ? (targetLayout.publishedConfig || targetLayout.config) : targetLayout.config;
        if (cfg?.recordsPerPage) setRecordsPerPage(cfg.recordsPerPage);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeMenu?.dataModelId, activeMenu?.listViewId, location.pathname]);

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
      .filter((f) => !['is_active', 'is_system', 'tenant_id', 'owner_id'].includes(f.fieldName.toLowerCase()))
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

  const listRuntimeRecords = useMemo(() => {
    let result = applyLayoutFilters(records, config, fields);
    result = applyLayoutSort(result, config, fields);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((rec) => {
        return visibleListColumns.some((col: any) => {
          const fd = fields.find((f) => f.id === col.fieldId || f.fieldName === col.fieldId);
          const val = fd ? rec[fd.fieldName] : rec[col.fieldId];
          return String(val ?? '').toLowerCase().includes(query);
        });
      });
    }

    Object.entries(runtimeFilters).forEach(([fieldId, filterText]) => {
      if (!filterText.trim()) return;
      const field = fields.find((f) => f.id === fieldId || f.fieldName === fieldId);
      if (!field) return;
      const lower = filterText.toLowerCase();
      result = result.filter((rec) => String(rec[field.fieldName] ?? '').toLowerCase().includes(lower));
    });

    if (runtimeSortRules.length > 0) {
      result = [...result].sort((a, b) => {
        for (const rule of runtimeSortRules) {
          const sf = fields.find((f) => f.id === rule.fieldId || f.fieldName === rule.fieldId);
          if (!sf) continue;
          const av = a[sf.fieldName]; const bv = b[sf.fieldName];
          if (av == null && bv == null) continue;
          if (av == null) return 1; if (bv == null) return -1;
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return result;
  }, [records, config, fields, searchQuery, runtimeFilters, runtimeSortRules, visibleListColumns]);

  const totalPages = useMemo(() => {
    if (!allowPaging) return 1;
    return Math.max(1, Math.ceil(listRuntimeRecords.length / recordsPerPage));
  }, [allowPaging, listRuntimeRecords.length, recordsPerPage]);

  const safeCurrentPage = useMemo(() => {
    return Math.max(1, Math.min(currentPage, totalPages));
  }, [currentPage, totalPages]);

  const currentPageRecords = useMemo(() => {
    if (!allowPaging) return listRuntimeRecords;
    const start = (safeCurrentPage - 1) * recordsPerPage;
    return listRuntimeRecords.slice(start, start + recordsPerPage);
  }, [allowPaging, listRuntimeRecords, safeCurrentPage, recordsPerPage]);

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
    setCurrentPage(1);
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
      <div className="sails-dynamic-table sails-page-container">
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
      <div className="sails-dynamic-table sails-page-container">
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
      <div className="sails-dynamic-table sails-page-container">
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

  return (
    <div className="sails-dynamic-table sails-page-container">
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
          <button className="sails-btn sails-btn--primary">
            <Plus size={18} />
            <span>Add New</span>
          </button>
        </div>
      </header>

      {/* ── Layout Studio Preview Mode Runtime Table ── */}
      <section className="sails-dynamic-table__content">
        <div className="ls-table-card">
          <div className="ls-table-card__header">
            <Columns size={13} />
            <span className="ls-table-card__title">{displayTitle}</span>
            <span className="ls-table-card__badge" style={{ marginLeft: 'auto' }}>
              {listRuntimeRecords.length} rows
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
                            style={{ ...(col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : {}), textAlign: col.alignment || 'left' }}
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
                      const globalIndex = allowPaging ? (safeCurrentPage - 1) * recordsPerPage + ri : ri;
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
                              const cellText = f ? renderListFieldValue(f, rec) : (val !== undefined && val !== null ? String(val) : '—');

                              return (
                                <td
                                  key={col.id}
                                  className={`ls-rtd ${col.wrapText ? 'ls-rtd--wrap' : ''} ${isPrimary ? 'ls-rtd--primary' : ''}`}
                                  style={{ textAlign: col.alignment || 'left' }}
                                >
                                  {isPrimary ? (
                                    <a
                                      href={`#record-${rec.id}`}
                                      className="ls-primary-link"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const modelId = activeMenu?.dataModelId || layout?.tableId;
                                        const parts = location.pathname.split('/').filter(Boolean);
                                        const appSlug = parts[0] || 'admin';
                                        const targetLayoutParam = col.targetDetailLayoutId ? `?layoutId=${col.targetDetailLayoutId}` : '';
                                        const targetRoute = `/${appSlug}/models/${modelId}/${rec.id}${targetLayoutParam}`;
                                        console.log('Navigating to Record Detail:', { route: targetRoute, recordId: rec.id, layoutId: col.targetDetailLayoutId });
                                        navigate(targetRoute);
                                      }}
                                      title={`View detail for ${cellText}`}
                                    >
                                      {cellText}
                                    </a>
                                  ) : (
                                    cellText
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

                {listRuntimeRecords.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <p className="ls-empty">No records match the current filters.</p>
                  </div>
                )}

                {allowPaging && listRuntimeRecords.length > 0 && (
                  <div className="ls-pagination">
                    <div className="ls-pagination__info">
                      <span className="ls-pagination__range">
                        Showing <strong>{(safeCurrentPage - 1) * recordsPerPage + 1}</strong> to <strong>{Math.min(safeCurrentPage * recordsPerPage, listRuntimeRecords.length)}</strong> of <strong>{listRuntimeRecords.length}</strong>
                      </span>
                      {pagingMode === 'dynamic' && (
                        <div className="ls-pagination__page-size">
                          <span className="ls-pagination__page-size-label">Records per page:</span>
                          <CustomSelect
                            value={recordsPerPage}
                            options={LIST_PER_PAGE_OPTIONS}
                            onChange={(v: number) => { setRecordsPerPage(v); setCurrentPage(1); }}
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
