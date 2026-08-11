import React, { useCallback, useMemo, useRef } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Check,
  Pencil,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { isSystemField, formatDateTimeValue, formatDecimalValue } from '@sails/shared';
import CustomSelect from '../common/CustomSelect';
import { UserControl, useTenantUsers } from '../../features/controls/plugins/UserControl';
import { PhoneControl } from '../../features/controls/plugins/PhoneControl';
import { EmailControl } from '../../features/controls/plugins/EmailControl';
import { LatLngControl } from '../../features/controls/plugins/LatLngControl';
import { DetailFieldInput } from '../../features/controls/DetailFieldControl';
import { useDateTimePrefs, isSystemDateTimeField, formatSystemDateTimeValue } from '../../utils/systemDateTime';
import SailsPopover from '../common/SailsPopover';

export interface RuntimeSortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
}

export interface ListViewTableProps {
  /** Parsed effective layout config (columns/sortBy/filters/recordsPerPage/...). */
  config?: any;
  fields: SailsFieldDefinition[];
  records: any[];
  totalRecords: number;
  /** 'page' = full list page (checkbox column, primary links); 'picker' = row-click selection. */
  mode?: 'page' | 'picker';
  /** Currently selected record id in picker mode (highlight + check icon). */
  pickerSelectedId?: string | null;
  /** Live search term — matching text in plain-text cells is highlighted. */
  highlightQuery?: string;

  // Controlled list state
  page: number;
  onPageChange: (p: number) => void;
  recordsPerPage: number;
  onRecordsPerPageChange: (n: number) => void;
  sortRules: RuntimeSortRule[];
  onSortRulesChange: (rules: RuntimeSortRule[]) => void;
  runtimeFilters: Record<string, string>;
  onRuntimeFiltersChange: (filters: Record<string, string>) => void;
  activePreviewFilter: string | null;
  onActivePreviewFilterChange: (id: string | null) => void;
  selectedIndices?: Set<number>;
  onSelectionChange?: (s: Set<number>) => void;

  // Row behavior
  onPrimaryLinkClick?: (rec: any, col: any, cellText: string) => void;
  onRowClick?: (rec: any, index: number) => void;

  /** Optional toolbar row rendered above the table (page-level badges/actions). */
  header?: React.ReactNode;

  // ── Inline edit / create / delete (page mode) ──
  allowInlineEdit?: boolean;
  editingRowId?: string | null;
  editDraft?: Record<string, any>;
  editErrors?: Record<string, string[]>;
  savingRow?: boolean;
  onStartEdit?: (rec: any) => void;
  onCellChange?: (fieldName: string, value: any) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  creatingRow?: boolean;
  createDraft?: Record<string, any>;
  createErrors?: Record<string, string[]>;
  savingCreate?: boolean;
  onCreateSave?: () => void;
  onCreateCancel?: () => void;
  /** Non-field error banner shown above the inline edit/create row. */
  formError?: string;
  allowInlineDelete?: boolean;
  confirmDeleteId?: string | null;
  deletingRow?: boolean;
  onRequestDelete?: (rec: any) => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
}

const NUMERIC_COLUMN_TYPES = new Set(['number', 'decimal', 'currency', 'percentage', 'percent']);

const LIST_PER_PAGE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

export function resolveLabel(col: any, fields: SailsFieldDefinition[]): string {
  const fd = fields.find((f) => f.id === col.fieldId || f.fieldName === col.fieldId);
  return col.labelOverride || fd?.name || col.fieldId;
}

/** Resolve the ordered, visible column list for a list view (synthetic fallback when layout has none). */
export function getVisibleColumns(config: any, fields: SailsFieldDefinition[]): any[] {  const raw = (config?.columns && config.columns.length > 0)
    ? config.columns
    : fields
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
      }));
  return [...raw]
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
    .filter((c: any) => c.visible !== false);
}

/** Format a single list cell value for display (text/boolean/date/currency/...). */
export function renderListFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
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

/** Wrap the first case-insensitive match of `query` in `text` with a highlight span. */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="ls-search-highlight">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export const ListViewTable: React.FC<ListViewTableProps> = ({
  config,
  fields,
  records,
  totalRecords,
  mode = 'page',
  pickerSelectedId,
  highlightQuery = '',
  page,
  onPageChange,
  recordsPerPage,
  onRecordsPerPageChange,
  sortRules,
  onSortRulesChange,
  runtimeFilters,
  onRuntimeFiltersChange,
  activePreviewFilter,
  onActivePreviewFilterChange,
  selectedIndices = new Set<number>(),
  onSelectionChange = () => {},
  onPrimaryLinkClick,
  onRowClick,
  header,
  allowInlineEdit = false,
  editingRowId = null,
  editDraft,
  editErrors,
  savingRow = false,
  onStartEdit,
  onCellChange,
  onSaveEdit,
  onCancelEdit,
  creatingRow = false,
  createDraft,
  createErrors,
  savingCreate = false,
  onCreateSave,
  onCreateCancel,
  formError,
  allowInlineDelete = false,
  confirmDeleteId = null,
  deletingRow = false,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}) => {
  const datetimePrefs = useDateTimePrefs();
  const { users: tenantUsers } = useTenantUsers();
  /** Per-column header refs, used to anchor the filter popovers. */
  const filterThRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  const userDisplayName = useCallback((value: any): string => {
    if (typeof value === 'object' && value) return value?.name || value?.email || value?.id || '';
    const str = String(value ?? '').trim();
    if (!str) return '';
    const u = tenantUsers.find((x) => x.id === str || x.name === str || x.email === str);
    return u?.name || str;
  }, [tenantUsers]);

  const allowMultiSelect = mode === 'page' && (config?.allowMultiSelect ?? true);
  const allowPaging = config?.allowPaging ?? true;
  const pagingMode = config?.pagingMode || 'dynamic';
  const inlineEnabled = mode === 'page' && allowInlineEdit;

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
        position: idx,
      }));
  }, [config, fields]);

  const sortedListColumns = useMemo(() => {
    return [...rawCols].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  }, [rawCols]);

  const visibleListColumns = useMemo(() => {
    return sortedListColumns.filter((c: any) => c.visible !== false);
  }, [sortedListColumns]);

  /** Field defs of visible columns that are user-editable (non-system). */
  const editableFields = useMemo(() => {
    const seen = new Set<string>();
    const out: SailsFieldDefinition[] = [];
    for (const col of visibleListColumns) {
      const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
      if (f && !isSystemField(f.fieldName) && !seen.has(f.fieldName)) {
        seen.add(f.fieldName);
        out.push(f);
      }
    }
    return out;
  }, [visibleListColumns, fields]);

  const totalPages = useMemo(() => {
    if (!allowPaging) return 1;
    return Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  }, [allowPaging, totalRecords, recordsPerPage]);

  const safeCurrentPage = useMemo(() => {
    return Math.max(1, Math.min(page, totalPages));
  }, [page, totalPages]);

  const allSelectedOnPage = useMemo(() => {
    if (records.length === 0) return false;
    return records.every((_, i) => selectedIndices.has(i));
  }, [records, selectedIndices]);

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
    onSortRulesChange((() => {
      const idx = sortRules.findIndex((r) => r.fieldId === fieldId);
      if (idx === -1) return [...sortRules, { fieldId, direction: 'asc' as const }];
      if (sortRules[idx].direction === 'asc') {
        const next = [...sortRules];
        next[idx] = { fieldId, direction: 'desc' as const };
        return next;
      }
      return sortRules.filter((r) => r.fieldId !== fieldId);
    })());
  };

  const handleRuntimeFilter = (fieldId: string, value: string) => {
    onRuntimeFiltersChange({ ...runtimeFilters, [fieldId]: value });
  };

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      onSelectionChange(new Set());
    } else {
      const next = new Set<number>();
      records.forEach((_, i) => next.add(i));
      onSelectionChange(next);
    }
  };

  const toggleSelectRecord = (globalIdx: number) => {
    onSelectionChange((() => {
      const next = new Set(selectedIndices);
      if (next.has(globalIdx)) next.delete(globalIdx);
      else next.add(globalIdx);
      return next;
    })());
  };

  /** Inline editor cell for an editable column (edit row or create row). */
  const renderEditorCell = (f: SailsFieldDefinition, draft: Record<string, any> | undefined, errors: Record<string, string[]> | undefined) => {
    return (
      <DetailFieldInput
        field={f}
        fieldKey={f.fieldName}
        label={f.name}
        val={draft?.[f.fieldName] ?? ''}
        showErrors={!!errors?.[f.fieldName]?.length}
        record={draft || {}}
        onChange={(_k, v) => onCellChange && onCellChange(f.fieldName, v)}
      />
    );
  };

  const renderInlineActions = (
    saving: boolean,
    onSave: (() => void) | undefined,
    onCancel: (() => void) | undefined
  ) => (
    <div className="ls-inline-actions">
      <button
        type="button"
        className="sails-btn sails-btn--primary sails-btn--sm"
        onClick={onSave}
        disabled={saving}
        title="Save"
      >
        {saving ? <Loader2 size={13} className="ls-spin" /> : <Check size={13} />}
      </button>
      <button
        type="button"
        className="sails-btn sails-btn--ghost sails-btn--sm"
        onClick={onCancel}
        disabled={saving}
        title="Cancel"
      >
        <X size={13} />
      </button>
    </div>
  );

  return (
    <div className="ls-table-card">
      {header}
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
                          checked={records.length > 0 && allSelectedOnPage}
                          ref={(el) => { if (el) el.indeterminate = !allSelectedOnPage && records.some((_, i) => selectedIndices.has(i)); }}
                          onChange={toggleSelectAll}
                          title="Select all on page"
                        />
                      </div>
                    </th>
                  )}
                  {visibleListColumns.map((col: any) => {
                    const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                    const label = resolveLabel(col, fields);
                    const runtimeSortIdx = sortRules.findIndex((r) => r.fieldId === col.fieldId || (f && r.fieldId === f.id));
                    const isSorted = runtimeSortIdx !== -1;
                    const sortDir = isSorted ? sortRules[runtimeSortIdx].direction : null;
                    const isFiltering = !!(col.fieldId && runtimeFilters[col.fieldId]?.trim());
                    return (
                      <th
                        key={col.id}
                        ref={(el) => { filterThRefs.current[col.id] = el; }}
                        className={`ls-rth ${col.allowSorting !== false ? 'ls-rth--sortable' : ''} ${isSorted ? 'ls-rth--sorted' : ''}`}
                        style={{ ...(col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : {}), textAlign: col.alignment || (f && NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}
                      >
                        <div className="ls-rth__inner">
                          {col.allowSorting !== false ? (
                            <button type="button" className="ls-rth__sort-btn" onClick={() => handleRuntimeSort(col.id)}>
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
                                type="button"
                                className={`ls-rth__filter-btn ${isFiltering ? 'ls-rth__filter-btn--active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActivePreviewFilterChange(activePreviewFilter === col.fieldId ? null : col.fieldId);
                                }}
                                title="Filter this column"
                              >
                                <Search size={11} />
                              </button>
                              {activePreviewFilter === col.fieldId && (
                                <SailsPopover
                                  open
                                  triggerRef={{ current: filterThRefs.current[col.id] }}
                                  align="right"
                                  className="ls-rth__filter-popover"
                                  deps={[!!runtimeFilters[col.fieldId]]}
                                  onClose={() => onActivePreviewFilterChange(null)}
                                >
                                  <div onClick={(e) => e.stopPropagation()}>
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
                                        type="button"
                                        className="ls-rth__filter-clear"
                                        onClick={() => {
                                          handleRuntimeFilter(col.fieldId, '');
                                          onActivePreviewFilterChange(null);
                                        }}
                                      >
                                        <X size={12} /> Clear
                                      </button>
                                    )}
                                  </div>
                                </SailsPopover>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {(inlineEnabled || creatingRow || allowInlineDelete) && <th className="ls-rth ls-rth--actions" style={{ width: 88, minWidth: 88 }} />}
                </tr>
              </thead>
              <tbody>
                {formError && (
                  <tr className="ls-inline-form-error-row">
                    <td
                      colSpan={visibleListColumns.length + (allowMultiSelect ? 1 : 0) + ((inlineEnabled || creatingRow) ? 1 : 0)}
                      className="ls-inline-form-error"
                    >
                      {formError}
                    </td>
                  </tr>
                )}
                {creatingRow && (
                  <tr
                    className="ls-rtd-row ls-inline-create-row"
                    onKeyDown={(e) => {
                      // Inline editors can live inside a parent <form> (detail page) —
                      // never let Enter implicitly submit the surrounding form.
                      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
                    }}
                  >
                    {allowMultiSelect && <td className="ls-rtd ls-rtd--cb" />}
                    {visibleListColumns.map((col: any) => {
                      const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                      const editable = !!f && !isSystemField(f.fieldName);
                      return (
                        <td key={col.id} className={`ls-rtd ${editable ? 'ls-rtd--editing' : ''}`}>
                          {editable ? renderEditorCell(f, createDraft, createErrors) : '\u2014'}
                        </td>
                      );
                    })}
                    {(inlineEnabled || creatingRow) && (
                      <td className="ls-rtd ls-rtd--actions">
                        {renderInlineActions(savingCreate, onCreateSave, onCreateCancel)}
                      </td>
                    )}
                  </tr>
                )}

                {records.map((rec, ri) => {
                  const globalIndex = ri;
                  const isPickerSelected = mode === 'picker' && !!pickerSelectedId && rec.id === pickerSelectedId;
                  const isEditingRow = inlineEnabled && editingRowId === rec.id;
                  const rowClassName =
                    mode === 'picker'
                      ? `ls-rtd-row${isPickerSelected ? ' ls-rtd-row--selected' : ''}${onRowClick ? ' ls-rtd-row--clickable' : ''}`
                      : `ls-rtd-row ${selectedIndices.has(globalIndex) ? 'ls-rtd-row--selected' : ''}${isEditingRow ? ' ls-rtd-row--editing' : ''}`;
                  return (
                    <tr
                      key={rec.id || ri}
                      className={rowClassName}
                      onClick={mode === 'picker' && onRowClick ? () => onRowClick(rec, globalIndex) : undefined}
                      onKeyDown={
                        isEditingRow && inlineEnabled
                          ? (e) => {
                              if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
                            }
                          : undefined
                      }
                    >
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
                        return visibleListColumns.map((col: any, ci: number) => {
                          const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                          const val = f ? rec[f.fieldName] : rec[col.fieldId];
                          const isPrimary = mode === 'page' && col.id === primaryColId;
                          const isUserColumn = !!f && f.logicalType === 'user';
                          const isPhoneColumn = !!f && f.logicalType === 'phone';
                          const isEmailColumn = !!f && f.logicalType === 'email';
                          const isLatLngColumn = !!f && f.logicalType === 'lat_lng';
                          const editable = !!f && !isSystemField(f.fieldName);
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
                                  : highlightText(cellText, highlightQuery);

                          return (
                            <td
                              key={col.id}
                              className={`ls-rtd ${col.wrapText ? 'ls-rtd--wrap' : ''} ${isPrimary ? 'ls-rtd--primary' : ''} ${isEditingRow && editable ? 'ls-rtd--editing' : ''}`}
                              style={{ textAlign: col.alignment || (f && NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}
                            >
                              {mode === 'picker' && isPickerSelected && ci === 0 && (
                                <Check size={13} className="ls-picker-check" />
                              )}
                              {isEditingRow && editable ? (
                                renderEditorCell(f, editDraft, editErrors)
                              ) : isPrimary ? (
                                <a
                                  href={`#record-${rec.id}`}
                                  className="ls-primary-link"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onPrimaryLinkClick) onPrimaryLinkClick(rec, col, cellText);
                                  }}
                                  title={`View detail for ${cellText}`}
                                >
                                  {highlightText(cellText, highlightQuery)}
                                </a>
                              ) : (
                                cellNode
                              )}
                            </td>
                          );
                        });
                      })()}
                      {(inlineEnabled || allowInlineDelete) && (
                        <td className="ls-rtd ls-rtd--actions" onClick={(e) => e.stopPropagation()}>
                          {isEditingRow ? (
                            renderInlineActions(savingRow, onSaveEdit, onCancelEdit)
                          ) : confirmDeleteId === rec.id ? (
                            <div className="ls-inline-actions">
                              <button
                                type="button"
                                className="sails-btn sails-btn--danger sails-btn--sm"
                                onClick={onConfirmDelete}
                                disabled={deletingRow}
                                title="Confirm delete"
                              >
                                {deletingRow ? <Loader2 size={13} className="ls-spin" /> : <Trash2 size={13} />}
                              </button>
                              <button
                                type="button"
                                className="sails-btn sails-btn--ghost sails-btn--sm"
                                onClick={onCancelDelete}
                                disabled={deletingRow}
                                title="Cancel"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="ls-inline-actions">
                              {allowInlineEdit && (
                                <button
                                  type="button"
                                  className="ls-inline-edit-btn"
                                  onClick={() => onStartEdit && onStartEdit(rec)}
                                  title="Edit inline"
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                              {allowInlineDelete && (
                                <button
                                  type="button"
                                  className="ls-inline-edit-btn ls-inline-edit-btn--danger"
                                  onClick={() => onRequestDelete && onRequestDelete(rec)}
                                  title="Delete record"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalRecords === 0 && !creatingRow && (
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
                        onChange={(v: number) => { onRecordsPerPageChange(v); }}
                        size="sm"
                        direction="up"
                      />
                    </div>
                  )}
                </div>
                <div className="ls-pagination__controls">
                  <button
                    type="button"
                    className="ls-pagination__btn"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => onPageChange(safeCurrentPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e-${i}`} className="ls-pagination__ellipsis">...</span>
                    ) : safeCurrentPage === p ? (
                      <span key={p} className="ls-pagination-page ls-pagination-page--active">{p}</span>
                    ) : (
                      <button key={p} type="button" className="ls-pagination-page ls-pagination-page--clickable" onClick={() => onPageChange(p)}>{p}</button>
                    )
                  )}
                  <button
                    type="button"
                    className="ls-pagination__btn"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => onPageChange(safeCurrentPage + 1)}
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
  );
};

export default ListViewTable;
