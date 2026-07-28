/**
 * MOCK UP — Table View Builder (LIST layout editor)
 *
 * Designed to integrate into Layout Studio as the viewType='LIST' mode.
 * Replaces the sections/blocks WYSIWYG canvas with a column picker +
 * filter builder + table preview for building saved list views.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2, MoveUp, MoveDown,
  LayoutGrid, Settings, ArrowRight, Columns,
  Filter, ArrowUpDown, Play, Pause, Minimize2, Maximize2,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { MOCK_LEADS_FIELDS } from './sample-layout-data';
import './TableBuilder.css';

// ─── Types ────────────────────────────────────────────────────

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'is_empty' | 'is_not_empty';

interface LayoutColumn {
  id: string;
  fieldId: string;
  position: number;
  visible: boolean;
  width?: number;
  widthUnit?: 'px' | '%';
  labelOverride?: string;
}

interface LayoutFilter {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: string;
  logic: 'and' | 'or';
}

interface LayoutSort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

// ─── Mock Data ────────────────────────────────────────────────

const MOCK_RECORDS: Record<string, any>[] = [
  { lead_name: 'ACME Corp Deal', company: 'ACME Corporation', email: 'j.doe@acme.com', phone: '+66 2 123 4567', status: 'qualified', source: 'website', budget: 250000, contact_date: '2026-06-15', notes: 'Met at Tech Summit.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Beta Inc Partnership', company: 'Beta Inc', email: 'p.smith@beta.com', phone: '+66 81 234 5678', status: 'new', source: 'referral', budget: 50000, contact_date: '2026-07-01', notes: 'Referred by Jane.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Gamma Ltd Contract', company: 'Gamma Ltd', email: 't.lee@gamma.com', phone: '+66 89 876 5432', status: 'contacted', source: 'event', budget: 150000, contact_date: '2026-07-10', notes: 'Bangkok Tech Week.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Delta Co Inquiry', company: 'Delta Co', email: 'w.brown@delta.com', phone: '+66 3 456 7890', status: 'lost', source: 'website', budget: 75000, contact_date: '2026-06-20', notes: 'Went with competitor.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Epsilon Solutions', company: 'Epsilon Co Ltd', email: 'm.davis@epsilon.com', phone: '+66 4 567 8901', status: 'qualified', source: 'website', budget: 500000, contact_date: '2026-07-20', notes: 'Large enterprise deal.', assigned_to: 'Somsak Chaiyaporn' },
];

// ─── Helpers ──────────────────────────────────────────────────

let colCounter = 0;
function colId(): string { colCounter++; return `col_${Date.now()}_${colCounter}`; }

let filtCounter = 0;
function filtId(): string { filtCounter++; return `filt_${Date.now()}_${filtCounter}`; }

function renderFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
  const val = record[field.fieldName];
  if (val === undefined || val === null) return '\u2014';
  if (field.logicalType === 'currency') return `\u0E3F${val.toLocaleString()}`;
  if (field.logicalType === 'boolean') return val ? 'Yes' : 'No';
  if (field.logicalType === 'select') {
    const options = (field.config as any)?.options || [];
    return options.find((o: any) => o.value === val)?.label || String(val);
  }
  return String(val);
}

// ─── Default Columns ──────────────────────────────────────────

function buildDefaultColumns(): LayoutColumn[] {
  colCounter = 0;
  return [
    { id: colId(), fieldId: 'f_001', position: 0, visible: true },
    { id: colId(), fieldId: 'f_002', position: 1, visible: true },
    { id: colId(), fieldId: 'f_003', position: 2, visible: true },
    { id: colId(), fieldId: 'f_005', position: 3, visible: true },
    { id: colId(), fieldId: 'f_006', position: 4, visible: true },
  ];
}

// ─── Component ────────────────────────────────────────────────

const TableBuilder: React.FC = () => {
  const allFields = MOCK_LEADS_FIELDS;

  const [viewName, setViewName] = useState('Default List View');
  const [columns, setColumns] = useState<LayoutColumn[]>(buildDefaultColumns);
  const [filters, setFilters] = useState<LayoutFilter[]>([
    { id: filtId(), fieldId: 'f_005', operator: 'eq', value: 'qualified', logic: 'and' },
  ]);
  const [sort, setSort] = useState<LayoutSort>({ fieldId: 'f_008', direction: 'desc' });
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [paletteFloating, setPaletteFloating] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(220);
  const [paletteResizing, setPaletteResizing] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [propsFloating, setPropsFloating] = useState(false);
  const [propsWidth, setPropsWidth] = useState(260);
  const [propsResizing, setPropsResizing] = useState(false);
  const [columnResizing, setColumnResizing] = useState<{ columnId: string; startX: number; startWidth: number; widthUnit: string } | null>(null);

  useEffect(() => {
    if (!propsResizing) return;
    const onMove = (e: MouseEvent) => {
      setPropsWidth(Math.max(180, Math.min(500, window.innerWidth - e.clientX)));
    };
    const onUp = () => setPropsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [propsResizing]);

  useEffect(() => {
    if (!paletteResizing) return;
    const onMove = (e: MouseEvent) => {
      setPaletteWidth(Math.max(160, Math.min(400, e.clientX + 4)));
    };
    const onUp = () => setPaletteResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [paletteResizing]);

  useEffect(() => {
    if (!columnResizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - columnResizing.startX;
      const newWidthPx = Math.max(60, columnResizing.startWidth + delta);
      const unit = columnResizing.widthUnit || 'px';
      setColumns((c) =>
        c.map((col) => {
          if (col.id !== columnResizing.columnId) return col;
          if (unit === '%') {
            const table = document.querySelector('.tb-preview-table') as HTMLElement;
            if (!table) return { ...col, width: newWidthPx, widthUnit: 'px' };
            const pct = Math.round((newWidthPx / table.offsetWidth) * 100);
            return { ...col, width: Math.max(5, Math.min(90, pct)), widthUnit: '%' };
          }
          return { ...col, width: newWidthPx, widthUnit: 'px' };
        })
      );
    };
    const onUp = () => setColumnResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [columnResizing]);

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  const placedFieldIds = columns.map((c) => c.fieldId);
  const availableFields = allFields.filter((f) => !placedFieldIds.includes(f.id));

  const selectedColumn = useMemo(
    () => columns.find((c) => c.id === selectedColumnId) ?? null,
    [columns, selectedColumnId]
  );

  const selectedColumnField = useMemo(
    () => (selectedColumn?.fieldId ? allFields.find((f) => f.id === selectedColumn.fieldId) : null),
    [selectedColumn, allFields]
  );

  const selectedFilter = useMemo(
    () => filters.find((f) => f.id === selectedFilterId) ?? null,
    [filters, selectedFilterId]
  );

  const sortField = useMemo(
    () => allFields.find((f) => f.id === sort.fieldId),
    [sort.fieldId, allFields]
  );

  // ─── Column Actions ───

  const addColumn = (fieldId: string) => {
    const col: LayoutColumn = {
      id: colId(),
      fieldId,
      position: columns.length,
      visible: true,
    };
    setColumns((c) => [...c, col]);
    setSelectedColumnId(col.id);
    setSelectedFilterId(null);
  };

  const removeColumn = (columnId: string) => {
    setColumns((c) => {
      const idx = c.findIndex((col) => col.id === columnId);
      if (idx === -1) return c;
      const removed = c.filter((col) => col.id !== columnId);
      return removed.map((col, i) => ({ ...col, position: i }));
    });
    if (selectedColumnId === columnId) setSelectedColumnId(null);
  };

  const toggleColumnVisible = (columnId: string) => {
    setColumns((c) =>
      c.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    );
  };

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumns((c) => {
      const sorted = [...c].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((col) => col.id === columnId);
      if (idx === -1) return c;
      const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (otherIdx < 0 || otherIdx >= sorted.length) return c;
      return c.map((col) => {
        if (col.id === sorted[idx].id) return { ...col, position: otherIdx };
        if (col.id === sorted[otherIdx].id) return { ...col, position: idx };
        return col;
      });
    });
  };

  const updateColumn = (columnId: string, patch: Partial<LayoutColumn>) => {
    setColumns((c) =>
      c.map((col) => (col.id === columnId ? { ...col, ...patch } : col))
    );
  };

  const handleColumnDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);
    try {
      const payload: { columnId: string } = JSON.parse(e.dataTransfer.getData('application/json'));
      if (payload.columnId === targetColumnId) return;

      const sorted = [...columns].sort((a, b) => a.position - b.position);
      const sourceIdx = sorted.findIndex((c) => c.id === payload.columnId);
      const targetIdx = sorted.findIndex((c) => c.id === targetColumnId);
      if (sourceIdx === -1 || targetIdx === -1) return;

      const reordered = [...sorted];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      setColumns(reordered.map((c, i) => ({ ...c, position: i })));
    } catch { /* ignore */ }
  };

  // ─── Filter Actions ───

  const addFilter = () => {
    const f: LayoutFilter = {
      id: filtId(),
      fieldId: allFields[0]?.id || '',
      operator: 'eq',
      value: '',
      logic: 'and',
    };
    setFilters((filters) => [...filters, f]);
    setSelectedFilterId(f.id);
    setSelectedColumnId(null);
  };

  const removeFilter = (filterId: string) => {
    setFilters((f) => f.filter((flt) => flt.id !== filterId));
    if (selectedFilterId === filterId) setSelectedFilterId(null);
  };

  const updateFilter = (filterId: string, patch: Partial<LayoutFilter>) => {
    setFilters((f) =>
      f.map((flt) => (flt.id === filterId ? { ...flt, ...patch } : flt))
    );
  };

  // ─── Sort Actions ───

  const updateSort = (patch: Partial<LayoutSort>) => {
    setSort((s) => ({ ...s, ...patch }));
  };

  // ─── Reset ───

  const doReset = () => {
    setViewName('Default List View');
    setColumns(buildDefaultColumns());
    setFilters([{ id: filtId(), fieldId: 'f_005', operator: 'eq', value: 'qualified', logic: 'and' }]);
    setSort({ fieldId: 'f_008', direction: 'desc' });
    setSelectedColumnId(null);
    setSelectedFilterId(null);
    setPaletteFloating(false);
    setPropsFloating(false);
    setShowResetConfirm(false);
    colCounter = 0;
    filtCounter = 0;
  };

  // ─── Filtered & Sorted Records ───

  const filteredRecords = useMemo(() => {
    return MOCK_RECORDS.filter((rec) => {
      if (filters.length === 0) return true;
      let result = true;
      filters.forEach((f, i) => {
        const field = allFields.find((fd) => fd.id === f.fieldId);
        if (!field) return;
        const val = rec[field.fieldName];
        const cmp = f.value;
        let match = true;
        switch (f.operator) {
          case 'eq':          match = String(val) === cmp; break;
          case 'neq':         match = String(val) !== cmp; break;
          case 'contains':    match = String(val || '').toLowerCase().includes(cmp.toLowerCase()); break;
          case 'is_empty':    match = val === undefined || val === null || String(val).trim() === ''; break;
          case 'is_not_empty':match = val !== undefined && val !== null && String(val).trim() !== ''; break;
          case 'gt':          match = Number(val) > Number(cmp); break;
          case 'gte':         match = Number(val) >= Number(cmp); break;
          case 'lt':          match = Number(val) < Number(cmp); break;
          case 'lte':         match = Number(val) <= Number(cmp); break;
        }
        result = i === 0 ? match : (f.logic === 'or' ? (result || match) : (result && match));
      });
      return result;
    });
  }, [filters, MOCK_RECORDS, allFields]);

  const sortedRecords = useMemo(() => {
    const sf = sortField;
    if (!sf) return filteredRecords;
    return [...filteredRecords].sort((a, b) => {
      const av = a[sf.fieldName];
      const bv = b[sf.fieldName];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredRecords, sort, sortField]);

  const visibleColumns = sortedColumns.filter((c) => c.visible);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className={`tb-root ${previewMode ? 'tb-root--preview' : ''}`}>
      {/* ── Toolbar ── */}
      <div className="tb-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tb-toolbar__brand">Table View Builder</span>
          <span style={{ fontSize: 11, color: 'var(--sails-text-muted)' }}>— LIST layout (mockup)</span>
        </div>
        <div className="tb-toolbar__actions">
          {previewMode ? (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setPreviewMode(false)}>
              <Pause size={14} /> Exit Preview
            </button>
          ) : (
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(true)}>
                Reset
              </button>
              <button className="sails-btn sails-btn--primary sails-btn--sm">Save View</button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="tb-body" style={{ gridTemplateColumns: (() => {
        if (previewMode) return '1fr';
        const pw = showProperties ? propsWidth : 36;
        const lw = paletteWidth;
        const leftCol = paletteFloating ? '' : `${lw}px `;
        const rightCol = propsFloating ? '' : ` ${pw}px`;
        return `${leftCol}1fr${rightCol}`;
      })() }}>
        {/* ── LEFT: Field Palette ── */}
        {!previewMode && (
          <div
            className={`tb-palette-outer ${paletteFloating ? 'tb-palette-outer--floating' : ''} ${paletteVisible ? 'tb-palette-outer--open' : ''}`}
            style={{ width: paletteFloating ? (paletteVisible ? paletteWidth : 36) : '100%' }}
            onMouseEnter={() => { if (paletteFloating) setPaletteVisible(true); }}
            onMouseLeave={() => { if (paletteFloating) setPaletteVisible(false); }}
          >
            {paletteVisible && (
              <>
            <div className="tb-palette-resize" onMouseDown={(e) => { e.preventDefault(); setPaletteResizing(true); }} />
            <div className="tb-palette">
              <div className="tb-palette__header">
                <h3 className="tb-panel-title"><LayoutGrid size={13} /> Fields</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="tb-palette__count">{availableFields.length}</span>
                  <button className="tb-block__btn" onClick={() => setPaletteFloating(!paletteFloating)} title={paletteFloating ? 'Dock palette' : 'Float palette'}>
                    {paletteFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                  </button>
                </div>
              </div>
              <div className="tb-palette__fields">
                <div className="tb-palette__group-label">AVAILABLE FIELDS</div>
                {availableFields.map((f) => (
                  <div
                    key={f.id}
                    className="tb-palette-field"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'field', fieldId: f.id }));
                    }}
                    onClick={() => addColumn(f.id)}
                  >
                    <GripVertical size={12} />
                    <span>{f.name}</span>
                    <span className="tb-type-tag">{f.logicalType}</span>
                    <ArrowRight size={12} className="tb-add-icon" />
                  </div>
                ))}
                {availableFields.length === 0 && (
                  <p className="tb-empty">All fields added to columns</p>
                )}
                <div className="tb-palette__group-label">ALREADY ADDED</div>
                {placedFieldIds.map((pfId) => {
                  const f = allFields.find((ff) => ff.id === pfId);
                  if (!f) return null;
                  return (
                    <div key={pfId} className="tb-palette-field tb-palette-field--placed">
                      <span>{f.name}</span>
                      <span className="tb-type-tag">{f.logicalType}</span>
                      <button
                        className="tb-block__btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const col = columns.find((c) => c.fieldId === pfId);
                          if (col) removeColumn(col.id);
                        }}
                        title="Remove column"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
              </>
            )}
            {!paletteVisible && (
              <div className="tb-palette-tab" onClick={() => setPaletteVisible(true)}>
                <LayoutGrid size={14} />
              </div>
            )}
          </div>
        )}

        {/* ── CENTER: Canvas ── */}
        <div className="tb-canvas">
          <div className="tb-canvas__scroll">
            <div className="tb-page">
              {/* ── View Name ── */}
              <div className="tb-page__header">
                <input
                  className="tb-view-name-input"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                />
                <p className="tb-page__subtitle">
                  Select columns, define filters and sort order to build your list view.
                </p>
              </div>

              {/* ── Filter Builder ── */}
              <div className="tb-card">
                <div className="tb-card__header">
                  <Filter size={13} />
                  <span className="tb-card__title">Filters</span>
                  {filters.length > 0 && (
                    <span className="tb-card__badge">{filters.length}</span>
                  )}
                </div>
                <div className="tb-card__body">
                  {filters.length === 0 ? (
                    <p className="tb-hint">No filters applied. All records shown.</p>
                  ) : (
                    <div className="tb-filter-list">
                      {filters.map((f, i) => {
                        const ff = allFields.find((fd) => fd.id === f.fieldId);
                        const isSelected = selectedFilterId === f.id;
                        return (
                          <div
                            key={f.id}
                            className={`tb-filter-row ${isSelected ? 'tb-filter-row--selected' : ''}`}
                            onClick={() => { setSelectedFilterId(f.id); setSelectedColumnId(null); }}
                          >
                            {i > 0 && (
                              <div className="tb-filter-logic">
                                {(['and', 'or'] as const).map((l) => (
                                  <button
                                    key={l}
                                    className={`tb-btn-logic ${f.logic === l ? 'tb-btn-logic--active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); updateFilter(f.id, { logic: l }); }}
                                  >
                                    {l.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="tb-filter-field-row">
                              <select
                                className="sails-input"
                                value={f.fieldId}
                                onChange={(e) => updateFilter(f.id, { fieldId: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 11, padding: '4px 6px', width: 140 }}
                              >
                                {allFields.map((fd) => (
                                  <option key={fd.id} value={fd.id}>{fd.name}</option>
                                ))}
                              </select>
                              <select
                                className="sails-input"
                                value={f.operator}
                                onChange={(e) => updateFilter(f.id, { operator: e.target.value as FilterOperator })}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 11, padding: '4px 6px', width: 110 }}
                              >
                                <option value="eq">= equals</option>
                                <option value="neq">&ne; not equal</option>
                                <option value="gt">&gt; greater than</option>
                                <option value="gte">&ge; gte</option>
                                <option value="lt">&lt; less than</option>
                                <option value="lte">&le; lte</option>
                                <option value="contains">contains</option>
                                <option value="is_empty">is empty</option>
                                <option value="is_not_empty">is not empty</option>
                              </select>
                              {!['is_empty', 'is_not_empty'].includes(f.operator) && (
                                <input
                                  className="sails-input"
                                  value={f.value}
                                  onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="value..."
                                  style={{ fontSize: 11, padding: '4px 6px', width: 120 }}
                                />
                              )}
                              <button
                                className="tb-block__btn tb-block__btn--danger"
                                onClick={(e) => { e.stopPropagation(); removeFilter(f.id); }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    className="sails-btn sails-btn--ghost sails-btn--sm"
                    onClick={addFilter}
                    style={{ marginTop: 8 }}
                  >
                    <Plus size={12} /> Add Filter
                  </button>
                </div>
              </div>

              {/* ── Sort Configuration ── */}
              <div className="tb-card">
                <div className="tb-card__header">
                  <ArrowUpDown size={13} />
                  <span className="tb-card__title">Sort By</span>
                </div>
                <div className="tb-card__body">
                  <div className="tb-sort-row">
                    <select
                      className="sails-input"
                      value={sort.fieldId}
                      onChange={(e) => updateSort({ fieldId: e.target.value })}
                      style={{ fontSize: 11, padding: '4px 6px', width: 180 }}
                    >
                      {allFields.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <div className="tb-sort-direction">
                      {(['asc', 'desc'] as const).map((d) => (
                        <button
                          key={d}
                          className={`tb-btn-sort ${sort.direction === d ? 'tb-btn-sort--active' : ''}`}
                          onClick={() => updateSort({ direction: d })}
                        >
                          {d === 'asc' ? '\u25B2' : '\u25BC'} {d === 'asc' ? 'ASC' : 'DESC'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── WYSIWYG Columns + Table ── */}
              <div className="tb-card">
                <div className="tb-card__header">
                  <Columns size={13} />
                  <span className="tb-card__title">Columns</span>
                  <span className="tb-card__badge">{columns.length}</span>
                  <span style={{ fontSize: 11, color: 'var(--sails-text-muted)', marginLeft: 4 }}>
                    ({visibleColumns.length} visible)
                  </span>
                  <span className="tb-card__badge" style={{ marginLeft: 'auto' }}>{sortedRecords.length} rows</span>
                </div>
                <div className="tb-card__body" style={{ padding: 0 }}>
                  {columns.length === 0 ? (
                    <div style={{ padding: 16 }}>
                      <p className="tb-empty">No columns added. Click a field from the palette.</p>
                    </div>
                  ) : (
                    <div className="tb-preview-wrap">
                      <table className="tb-preview-table">
                        <thead>
                          <tr>
                            {sortedColumns.map((col) => {
                              const f = allFields.find((ff) => ff.id === col.fieldId);
                              if (!f) return null;
                              const isSelected = selectedColumnId === col.id;
                              const isDragOver = dragOverColumnId === col.id;
                              return (
                                <th
                                  key={col.id}
                                  className={`tb-th ${isSelected ? 'tb-th--selected' : ''} ${!col.visible ? 'tb-th--hidden' : ''} ${isDragOver ? 'tb-th--drag-over' : ''} ${columnResizing?.columnId === col.id ? 'tb-th--resizing' : ''}`}
                                  draggable={!columnResizing}
                                  onDragStart={(e) => {
                                    if (columnResizing) return;
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'column', columnId: col.id }));
                                  }}
                                  onDragOver={(e) => {
                                    if (columnResizing) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverColumnId(col.id);
                                  }}
                                  onDragLeave={() => setDragOverColumnId(null)}
                                  onDrop={(e) => handleColumnDrop(e, col.id)}
                                  onClick={() => { setSelectedColumnId(col.id); setSelectedFilterId(null); }}
                                  style={col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : undefined}
                                >
                                  <div className="tb-th__inner">
                                    <GripVertical size={12} className="tb-th__grip" />
                                    <span className="tb-th__label">
                                      {col.labelOverride || f.name}
                                    </span>
                                    {!col.visible && (
                                      <span className="tb-th__hidden-badge">hidden</span>
                                    )}
                                    <span className="tb-th__type">{f.logicalType}</span>
                                    <div className="tb-th__actions">
                                      <button
                                        className="tb-th__action"
                                        onClick={(e) => { e.stopPropagation(); toggleColumnVisible(col.id); }}
                                        title={col.visible ? 'Hide column' : 'Show column'}
                                      >
                                        {col.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                      </button>
                                      <button
                                        className="tb-th__action tb-th__action--remove"
                                        onClick={(e) => { e.stopPropagation(); removeColumn(col.id); }}
                                        title="Remove column"
                                      >
                                        <X size={11} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="tb-th__resize"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement;
                                      setColumnResizing({ columnId: col.id, startX: e.clientX, startWidth: th.offsetWidth, widthUnit: col.widthUnit || 'px' });
                                    }}
                                  />
                                </th>
                              );
                            })}
                            {/* Add column placeholder */}
                            <th className="tb-th tb-th--add" onClick={() => {
                              const next = availableFields[0];
                              if (next) addColumn(next.id);
                            }} title="Add a column">
                              <Plus size={14} />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRecords.map((rec, ri) => (
                            <tr key={ri}>
                              {sortedColumns.map((col) => {
                                const f = allFields.find((ff) => ff.id === col.fieldId);
                                if (!f) return <td key={col.id} className={`tb-td ${!col.visible ? 'tb-td--hidden' : ''}`}>—</td>;
                                return (
                                  <td key={col.id} className={`tb-td ${!col.visible ? 'tb-td--hidden' : ''}`}>
                                    {renderFieldValue(f, rec)}
                                  </td>
                                );
                              })}
                              <td className="tb-td tb-td--add"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Properties ── */}
        {!previewMode && (
          <div
            className={`tb-props-outer ${showProperties ? 'tb-props-outer--open' : ''} ${propsFloating ? 'tb-props-outer--floating' : ''}`}
            style={{ width: propsFloating ? (showProperties ? propsWidth : 36) : '100%' }}
            onMouseEnter={() => { if (propsFloating) setShowProperties(true); }}
            onMouseLeave={() => { if (propsFloating) setShowProperties(false); }}
          >
            {showProperties && (
              <>
                <div className="tb-props-resize" onMouseDown={(e) => { e.preventDefault(); setPropsResizing(true); }} />
                <div className="tb-properties">
                  <div className="tb-props-header">
                    <h3 className="tb-panel-title"><Settings size={13} /> Properties</h3>
                    <button className="tb-block__btn" onClick={() => {
                      const next = !propsFloating;
                      setPropsFloating(next);
                      if (!next) setShowProperties(true);
                    }} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>
                      {propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>
                  </div>

                {selectedColumn && selectedColumnField ? (
                  <>
                    <div className="tb-prop__name">{selectedColumnField.name}</div>
                    <div className="tb-prop__type">Column</div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedColumn.visible}
                          onChange={() => toggleColumnVisible(selectedColumn.id)}
                        />
                        Visible
                      </label>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Label Override</label>
                      <input
                        className="sails-input"
                        value={selectedColumn.labelOverride || ''}
                        onChange={(e) => updateColumn(selectedColumn.id, { labelOverride: e.target.value || undefined })}
                        placeholder={selectedColumnField.name}
                        style={{ fontSize: 12, padding: '5px 7px' }}
                      />
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Column Width</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          className="sails-input"
                          type="number"
                          value={selectedColumn.width || ''}
                          onChange={(e) => {
                            const v = e.target.value ? Number(e.target.value) : undefined;
                            updateColumn(selectedColumn.id, { width: v });
                          }}
                          placeholder="auto"
                          style={{ fontSize: 12, padding: '5px 7px', flex: 1 }}
                        />
                        <select
                          className="sails-input"
                          value={selectedColumn.widthUnit || 'px'}
                          onChange={(e) => updateColumn(selectedColumn.id, { widthUnit: e.target.value as 'px' | '%' })}
                          style={{ fontSize: 12, padding: '5px 7px', width: 60 }}
                        >
                          <option value="px">px</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Position</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          onClick={() => moveColumn(selectedColumn.id, 'up')}
                          disabled={selectedColumn.position === 0}
                        >
                          <MoveUp size={12} /> Up
                        </button>
                        <button
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          onClick={() => moveColumn(selectedColumn.id, 'down')}
                          disabled={selectedColumn.position >= columns.length - 1}
                        >
                          <MoveDown size={12} /> Down
                        </button>
                      </div>
                    </div>

                    <div className="tb-prop-group">
                      <button
                        className="sails-btn sails-btn--danger sails-btn--sm"
                        onClick={() => removeColumn(selectedColumn.id)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} /> Remove Column
                      </button>
                    </div>
                  </>
                ) : selectedFilter ? (
                  <>
                    <div className="tb-prop__name">Filter Rule</div>
                    <div className="tb-prop__type">Filter</div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Field</label>
                      <select
                        className="sails-input"
                        value={selectedFilter.fieldId}
                        onChange={(e) => updateFilter(selectedFilter.id, { fieldId: e.target.value })}
                        style={{ fontSize: 12, padding: '5px 7px' }}
                      >
                        {allFields.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Operator</label>
                      <select
                        className="sails-input"
                        value={selectedFilter.operator}
                        onChange={(e) => updateFilter(selectedFilter.id, { operator: e.target.value as FilterOperator })}
                        style={{ fontSize: 12, padding: '5px 7px' }}
                      >
                        <option value="eq">= equals</option>
                        <option value="neq">&ne; not equal</option>
                        <option value="gt">&gt; greater than</option>
                        <option value="gte">&ge; gte</option>
                        <option value="lt">&lt; less than</option>
                        <option value="lte">&le; lte</option>
                        <option value="contains">contains</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </select>
                    </div>

                    {!['is_empty', 'is_not_empty'].includes(selectedFilter.operator) && (
                      <div className="tb-prop-group">
                        <label className="tb-prop-label">Value</label>
                        <input
                          className="sails-input"
                          value={selectedFilter.value}
                          onChange={(e) => updateFilter(selectedFilter.id, { value: e.target.value })}
                          placeholder="value..."
                          style={{ fontSize: 12, padding: '5px 7px' }}
                        />
                      </div>
                    )}

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Logic (if chained)</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['and', 'or'] as const).map((l) => (
                          <button
                            key={l}
                            className={`tb-btn-logic tb-btn-logic--large ${selectedFilter.logic === l ? 'tb-btn-logic--active' : ''}`}
                            onClick={() => updateFilter(selectedFilter.id, { logic: l })}
                          >
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="tb-prop-group">
                      <button
                        className="sails-btn sails-btn--danger sails-btn--sm"
                        onClick={() => removeFilter(selectedFilter.id)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} /> Remove Filter
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="tb-empty" style={{ padding: 24 }}>
                    Select a column or filter to edit its properties.
                  </p>
                )}
                </div>
              </>
            )}
            {!showProperties && (
              <div className="tb-props-tab" onClick={() => setShowProperties(true)}>
                <Settings size={14} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
        <div className="tb-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="tb-modal__title">Reset View</h3>
            <p className="tb-modal__text">
              This will clear all columns, filters, and sort configuration.
              This action cannot be undone.
            </p>
            <div className="tb-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={doReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableBuilder;
