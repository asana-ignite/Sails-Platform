import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { X, MoreHorizontal, Search, Database } from 'lucide-react';
import { normalizeFilters, serializeFilterGroups } from '@sails/shared';
import { ListViewTable, type RuntimeSortRule } from '../../../components/list/ListViewTable';
import '../controls.css';

// ── Shared helpers ──────────────────────────────────────────────

/** Pick a label field: prefer display-ish text fields, fall back to recordnumber/name/title/id. */
function pickLabelFields(fields: any[]): string[] {
  const names = (fields || []).map((f: any) => f.fieldName || f.name).filter(Boolean);
  const preferred = ['name', 'title', 'recordnumber', 'label', 'code'];
  const hit = preferred.find((p) => names.includes(p));
  if (hit) return [hit];
  const textLike = (fields || []).filter((f: any) =>
    ['text', 'varchar', 'string', 'char', 'email', 'phone'].includes(String(f.type || f.physicalType || f.logicalType || '').toLowerCase())
  ).map((f: any) => f.fieldName || f.name);
  if (textLike.length > 0) return textLike.slice(0, 2);
  return names.length > 0 ? names.slice(0, 2) : ['id'];
}

function formatRecord(rec: any, labelFields: string[]): string {
  for (const f of labelFields) {
    const v = rec[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return rec.id || '—';
}

function parseId(value: any): string {
  return String(value ?? '').trim();
}

function safeParseConfig(raw: any): any {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Client-side search/filter/sort pipeline ─────────────────────

const MAX_PICKER_ROWS = 1000;
const BULK_PAGE_SIZE = 100;

/** Text-ish field types mirrored from the server's free-text search fields. */
const SEARCH_TEXT_TYPES = new Set([
  'text', 'varchar', 'string', 'char', 'email', 'phone', 'url', 'description',
  'short_text', 'long_text', 'rich_text', 'textarea',
]);

function isSearchableField(f: any): boolean {
  const t = String(f?.type || f?.physicalType || f?.logicalType || '').toLowerCase();
  return SEARCH_TEXT_TYPES.has(t);
}

const NUMERIC_SORT_TYPES = new Set(['number', 'decimal', 'currency', 'percentage', 'percent', 'auto_number']);
const DATE_SORT_TYPES = new Set(['date', 'datetime', 'timestamp', 'time']);

// ── List View layout helpers (shared by modal + chip label resolution) ──

/** Resolve the list layout: explicit id first, then the target's default LIST view. */
async function resolveListLayout(listViewId: string | undefined, targetTable: string): Promise<any> {
  if (listViewId) {
    const byId = await fetch(`/api/console/layouts?id=${encodeURIComponent(listViewId)}`).then(r => r.json());
    if (byId?.success && byId.data) return byId.data;
  }
  const list = await fetch(`/api/console/layouts?tableId=${encodeURIComponent(targetTable)}&viewType=LIST&page=1&limit=100`).then(r => r.json());
  const rowsArr: any[] = list?.data?.rows || [];
  return (
    rowsArr.find((r: any) => r.status === 'active' && r.isDefault) ||
    rowsArr.find((r: any) => r.status === 'active') ||
    rowsArr[0] ||
    null
  );
}

/** Field name of the list view's primary column (isPrimaryLink, else first visible column). */
function resolvePrimaryFieldName(layout: any, fields: any[]): string | null {
  if (!layout) return null;
  const cfg = layout.status === 'active' ? safeParseConfig(layout.publishedConfig) : safeParseConfig(layout.config);
  const cols = (cfg?.columns || []).filter((c: any) => c.visible !== false);
  if (cols.length === 0) return null;
  const primary = cols.find((c: any) => c.isPrimaryLink) || cols[0];
  const fd = (fields || []).find((f: any) => f.id === primary.fieldId || f.fieldName === primary.fieldId);
  return fd?.fieldName || null;
}

/** Display label for a stored record id: the list view's primary column value, else label-field fallback. */
async function resolveRecordLabel(listViewId: string, targetTable: string, id: string): Promise<string> {
  try {
    const [layout, recRes] = await Promise.all([
      resolveListLayout(listViewId, targetTable).catch(() => null),
      fetch(`/api/dynamic/${targetTable}?ids=${encodeURIComponent(id)}`).then(r => (r.ok ? r.json() : null)),
    ]);
    if (!recRes) return id;
    const fields = recRes.fields || [];
    const rec = (recRes.rows || []).find((r: any) => r.id === id);
    if (!rec) return id;
    const primaryName = resolvePrimaryFieldName(layout, fields);
    if (primaryName) {
      const v = rec[primaryName];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return formatRecord(rec, pickLabelFields(fields));
  } catch {
    return id;
  }
}

/** Default DETAIL view (active + isDefault → active → first) of a target model. */
async function resolveDefaultDetailLayout(targetTable: string): Promise<any> {
  try {
    const list = await fetch(`/api/console/layouts?tableId=${encodeURIComponent(targetTable)}&viewType=DETAIL&page=1&limit=100`).then(r => r.json());
    const rows: any[] = list?.data?.rows || [];
    return (
      rows.find((r: any) => r.status === 'active' && r.isDefault) ||
      rows.find((r: any) => r.status === 'active') ||
      rows[0] ||
      null
    );
  } catch {
    return null;
  }
}

/** Build the record detail route: {current menu path}/{detail layout systemName}/{record id}. */
function buildDetailRoute(pathname: string, detailSystemName: string, recordId: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const menuPath = '/' + parts.slice(0, Math.max(1, parts.length - 2)).join('/');
  return `${menuPath}/${detailSystemName}/${recordId}`;
}

// ── Search List modal (embedded List View picker) ───────────────

interface SearchListModalProps {
  open: boolean;
  onClose: () => void;
  targetTable: string;
  listViewId?: string;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}

const SearchListModal: React.FC<SearchListModalProps> = ({
  open, onClose, targetTable, listViewId, selectedIds, onSelect,
}) => {
  const [layout, setLayout] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [baseRows, setBaseRows] = useState<any[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List state (mirrors DynamicTablePage)
  const [page, setPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  const [searchDraft, setSearchDraft] = useState('');
  const [sortRules, setSortRules] = useState<RuntimeSortRule[]>([]);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, string>>({});
  const [activePreviewFilter, setActivePreviewFilter] = useState<string | null>(null);

  // Refs used by the bulk loader (avoids stale closures)
  const layoutRef = useRef<any>(null);
  const fieldsRef = useRef<any[]>([]);

  const effectiveConfig = useMemo(() => {
    if (!layout) return {};
    return layout.status === 'active' ? safeParseConfig(layout.publishedConfig) : safeParseConfig(layout.config);
  }, [layout]);

  const resolveLayout = useCallback(
    () => resolveListLayout(listViewId, targetTable),
    [listViewId, targetTable]
  );

  // Bulk-load all records once (layout saved filters + layout sort applied
  // server-side by the shared engine); search/filter/sort then run client-side.
  const loadAll = useCallback(async () => {
    if (!targetTable) return;
    setLoading(true);
    setError(null);
    try {
      const rawLayout = layoutRef.current;
      const lc = rawLayout
        ? (rawLayout.status === 'active' ? safeParseConfig(rawLayout.publishedConfig) : safeParseConfig(rawLayout.config))
        : {};
      const flds = fieldsRef.current;
      const findField = (idOrName: string) => flds.find((fd: any) => fd.id === idOrName || fd.fieldName === idOrName);

      const groups = normalizeFilters(lc?.filters);
      const filterGroups = serializeFilterGroups(groups, (fieldId) => {
        const field = findField(fieldId);
        return field?.fieldName || null;
      });

      const mergedSort: { fieldId: string; dir: 'asc' | 'desc' }[] = [];
      for (const s of (lc?.sortBy || [])) {
        const field = findField(s.fieldId || s.id);
        if (!field) continue;
        mergedSort.push({ fieldId: field.fieldName, dir: s.direction || 'asc' });
      }

      const all: any[] = [];
      let pageNum = 1;
      let total = 0;
      for (;;) {
        const params = new URLSearchParams();
        if (filterGroups.length) params.set('filterGroups', JSON.stringify(filterGroups));
        if (mergedSort.length) params.set('sort', JSON.stringify(mergedSort));
        params.set('page', String(pageNum));
        params.set('limit', String(BULK_PAGE_SIZE));

        const res = await fetch(`/api/dynamic/${targetTable}?${params}`);
        const data = await res.json();
        if (!data || !Array.isArray(data.rows)) throw new Error('No data');
        total = data.total || 0;
        all.push(...data.rows);
        if (data.rows.length < BULK_PAGE_SIZE) break;
        if (all.length >= MAX_PICKER_ROWS) break;
        pageNum += 1;
      }
      setBaseRows(all);
      setServerTotal(total);
      setTruncated(total > all.length);
    } catch (e: any) {
      setError(e?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [targetTable]);

  // Sequential init (mirrors DynamicTablePage): layout → fields → bulk load.
  // Resolving the target table's fields BEFORE the data fetch guarantees
  // saved filters/sort rules resolve their field ids against real definitions.
  useEffect(() => {
    if (!open || !targetTable) return;
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      setSearchDraft('');
      setSortRules([]);
      setRuntimeFilters({});
      setActivePreviewFilter(null);
      setBaseRows([]);
      setTruncated(false);
      try {
        const l = await resolveLayout();
        if (cancelled) return;
        layoutRef.current = l;
        setLayout(l);

        const meta = await fetch(`/api/dynamic/${targetTable}?page=1&limit=1`);
        const metaData = await meta.json();
        if (cancelled) return;
        fieldsRef.current = metaData.fields || [];
        setFields(fieldsRef.current);

        const eff = l ? (l.status === 'active' ? safeParseConfig(l.publishedConfig) : safeParseConfig(l.config)) : {};
        setRecordsPerPage(eff?.recordsPerPage || 25);

        await loadAll();
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load List View');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [open, targetTable, resolveLayout, loadAll]);

  // Client-side pipeline: search → column filters → sort → paging.
  const fieldById = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of fields) {
      m.set(f.id, f);
      if (f.fieldName) m.set(f.fieldName, f);
    }
    return m;
  }, [fields]);

  const filteredRows = useMemo(() => {
    const q = searchDraft.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const searchFields = fields.filter(isSearchableField);
    const activeFilters = Object.entries(runtimeFilters).filter(([, v]) => v?.trim());
    if (!hasSearch && activeFilters.length === 0) return baseRows;

    return baseRows.filter((rec) => {
      if (hasSearch) {
        let hit = false;
        if (searchFields.length > 0) {
          for (const f of searchFields) {
            const v = rec[f.fieldName];
            if (v !== undefined && v !== null && String(v).toLowerCase().includes(q)) { hit = true; break; }
          }
        } else {
          for (const v of Object.values(rec)) {
            if (v !== undefined && v !== null && String(v).toLowerCase().includes(q)) { hit = true; break; }
          }
        }
        if (!hit) return false;
      }
      for (const [fieldId, value] of activeFilters) {
        const f = fieldById.get(fieldId);
        const raw = f ? rec[f.fieldName] : rec[fieldId];
        const hay = raw === undefined || raw === null ? '' : String(raw);
        if (!hay.toLowerCase().includes(value.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [baseRows, searchDraft, runtimeFilters, fields, fieldById]);

  const sortedRows = useMemo(() => {
    if (sortRules.length === 0) return filteredRows;
    const rules = sortRules
      .map((r) => ({ rule: r, field: fieldById.get(r.fieldId) }))
      .filter((x) => !!x.field);
    if (rules.length === 0) return filteredRows;

    const compare = (a: any, b: any, field: any, dir: 'asc' | 'desc') => {
      const av = a[field.fieldName];
      const bv = b[field.fieldName];
      const mult = dir === 'desc' ? -1 : 1;
      const lt = String(field.logicalType || field.type || '');
      if (NUMERIC_SORT_TYPES.has(lt)) {
        const an = Number(av);
        const bn = Number(bv);
        if (Number.isNaN(an) && Number.isNaN(bn)) return 0;
        if (Number.isNaN(an)) return 1; // NaN always last
        if (Number.isNaN(bn)) return -1;
        return (an - bn) * mult;
      }
      if (DATE_SORT_TYPES.has(lt)) {
        const at = av ? Date.parse(av) : NaN;
        const bt = bv ? Date.parse(bv) : NaN;
        if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
        if (Number.isNaN(at)) return 1;
        if (Number.isNaN(bt)) return -1;
        return (at - bt) * mult;
      }
      const as = av === undefined || av === null ? '' : String(av);
      const bs = bv === undefined || bv === null ? '' : String(bv);
      return as.localeCompare(bs) * mult;
    };

    return [...filteredRows].sort((a, b) => {
      for (const { rule, field } of rules) {
        const c = compare(a, b, field, rule.direction);
        if (c !== 0) return c;
      }
      return 0;
    });
  }, [filteredRows, sortRules, fieldById]);

  const totalFiltered = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / recordsPerPage));
  const safePage = Math.max(1, Math.min(page, totalPages));

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * recordsPerPage;
    return sortedRows.slice(start, start + recordsPerPage);
  }, [sortedRows, safePage, recordsPerPage]);

  // Reset to the first page whenever the client filter set changes.
  useEffect(() => { setPage(1); }, [searchDraft, runtimeFilters, sortRules]);

  const handlePageChange = (p: number) => setPage(p);

  const handleRecordsPerPageChange = (n: number) => {
    setRecordsPerPage(n);
    setPage(1);
  };

  const handleSortChange = (rules: RuntimeSortRule[]) => setSortRules(rules);

  const handleFiltersChange = (filters: Record<string, string>) => setRuntimeFilters(filters);

  const pickRow = (rec: any) => {
    onSelect([rec.id]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="sails-searchlist-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sails-searchlist-modal__panel" role="dialog" aria-modal="true">
        <div className="sails-searchlist-modal__header">
          <div className="sails-searchlist-modal__title">
            <Database size={15} />
            <span>Select from {targetTable}</span>
          </div>
          <button type="button" className="sails-searchlist-modal__close" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="sails-searchlist-modal__search">
          <Search size={14} className="sails-searchlist-modal__search-icon" />
          <input
            type="text"
            autoFocus
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={`Search ${targetTable}...`}
            className="sails-searchlist-modal__search-input"
          />
        </div>

        <div className="sails-searchlist-modal__body">
          {loading && !layout ? (
            <div className="sails-searchlist-modal__empty">Loading List View...</div>
          ) : error ? (
            <div className="sails-searchlist-modal__empty">{error}</div>
          ) : !layout ? (
            <div className="sails-searchlist-modal__empty">
              No List View configured for <strong>{targetTable}</strong>. Configure one in Layout Studio.
            </div>
          ) : loading && baseRows.length === 0 ? (
            <div className="sails-searchlist-modal__empty">Loading records...</div>
          ) : (
            <>
              {truncated && (
                <div className="sails-searchlist-modal__hint">
                  Showing first {baseRows.length.toLocaleString()} of {serverTotal.toLocaleString()} records — search covers loaded rows
                </div>
              )}
              <ListViewTable
                mode="picker"
                config={effectiveConfig}
                fields={fields}
                records={visibleRows}
                totalRecords={totalFiltered}
                page={page}
                onPageChange={handlePageChange}
                recordsPerPage={recordsPerPage}
                onRecordsPerPageChange={handleRecordsPerPageChange}
                sortRules={sortRules}
                onSortRulesChange={handleSortChange}
                runtimeFilters={runtimeFilters}
                onRuntimeFiltersChange={handleFiltersChange}
                activePreviewFilter={activePreviewFilter}
                onActivePreviewFilterChange={setActivePreviewFilter}
                pickerSelectedId={selectedIds[0] || null}
                highlightQuery={searchDraft.trim()}
                onRowClick={pickRow}
              />
            </>
          )}
        </div>

        <div className="sails-searchlist-modal__footer">
          <button type="button" className="sails-input sails-searchlist-modal__cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Control plugin ──────────────────────────────────────────────

export const SearchListControl: FieldControlPlugin = {
  id: 'control:relation_search_list',
  name: 'Search List (List View Picker)',
  description: 'Opens the target model List View in a popup; selected rows become chips',
  iconName: 'List',
  compatibleTypes: ['relation'],
  isDefault: false,

  mockValue: () => 'Sample Record',

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const targetTable = cfg.targetTable || '';
    const listViewId = cfg.listView || '';
    const isInert = !onChange;

    const [chips, setChips] = useState<{ id: string; label: string }[]>([]);
    const [open, setOpen] = useState(false);

    const valueId = useMemo(() => parseId(value), [value]);

    // Resolve the stored id → chip label: the list view's primary column value.
    useEffect(() => {
      if (!valueId) { setChips([]); return; }
      if (!targetTable) { setChips([{ id: valueId, label: valueId }]); return; }
      let cancelled = false;
      resolveRecordLabel(listViewId, targetTable, valueId).then((label) => {
        if (!cancelled) setChips([{ id: valueId, label }]);
      });
      return () => { cancelled = true; };
    }, [valueId, targetTable, listViewId]);

    const emitId = (id: string) => onChange && onChange(id);

    const removeChip = () => {
      setChips([]);
      emitId('');
    };

    return (
      <div
        className={`sails-searchlist ${className}${readOnly || isInert ? ' is-readonly' : ''}`}
        onClick={(e) => {
          // Never let clicks inside the modal bubble up here — they would
          // immediately re-open the picker after Close/Cancel.
          if ((e.target as HTMLElement).closest('.sails-searchlist-modal')) return;
          if (!disabled && !readOnly && !isInert && chips.length === 0) setOpen(true);
        }}
      >
        <div className="sails-searchlist__chips">
          {chips.map((c) => (
            <span key={c.id} className="sails-email-chip">
              <span className="sails-searchlist__chip-label" title={c.id}>{c.label}</span>
              {!disabled && !readOnly && !isInert && (
                <button
                  type="button"
                  className="sails-email-chip__remove"
                  title="Remove selection"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeChip(); }}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {chips.length === 0 && (
            <span className="sails-searchlist__placeholder">Select record...</span>
          )}
        </div>
        {!disabled && !readOnly && !isInert && (
          <button
            type="button"
            className="sails-searchlist__trigger"
            title="Open List View"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
        <SearchListModal
          open={open}
          onClose={() => setOpen(false)}
          targetTable={targetTable}
          listViewId={listViewId}
          selectedIds={chips.map(c => c.id)}
          onSelect={(ids) => {
            const id = ids[0] ?? '';
            const next = chips.find(c => c.id === id) || { id, label: id };
            setChips(next ? [next] : []);
            emitId(id);
          }}
        />
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const cfg = (field?.config as any) || {};
    const targetTable = cfg.targetTable || '';
    const listViewId = cfg.listView || '';
    const [label, setLabel] = useState<string | null>(null);

    const raw = String(value ?? '').trim();
    // Platform record ids are 20-32 char CUIDs; mock/preview values are not.
    const isRealId = /^[a-z0-9_-]{20,32}$/.test(raw);

    useEffect(() => {
      if (!raw) { setLabel(null); return; }
      if (!targetTable) { setLabel(raw); return; }
      let cancelled = false;
      resolveRecordLabel(listViewId, targetTable, raw).then((l) => {
        if (!cancelled) setLabel(l);
      });
      return () => { cancelled = true; };
    }, [raw, targetTable, listViewId]);

    if (!raw) return <span>—</span>;

    const openDetail = async () => {
      if (!isRealId || !targetTable) return;
      const detail = await resolveDefaultDetailLayout(targetTable);
      if (!detail?.systemName) return;
      navigate(buildDetailRoute(location.pathname, detail.systemName, raw));
    };

    // Detail (view) mode: the value is a live link to the record's detail view.
    if (isRealId) {
      return (
        <span className="sails-searchlist-display">
          <button
            type="button"
            className="sails-searchlist__display-link"
            title={`Open detail view of ${label || raw}`}
            onClick={openDetail}
          >
            {label || `#${raw.slice(0, 10)}`}
          </button>
        </span>
      );
    }

    return (
      <span className="sails-searchlist-display">
        <span className="sails-email-link" title={raw}>{label || `#${raw.slice(0, 10)}`}</span>
      </span>
    );
  },
};
