/**
 * ListViewMobile — accordion/card rendering of a list view on small screens
 * (same data pipeline as ListViewTable).
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Check,
  Pencil,
  Loader2,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { isSystemField } from '@sails/shared';
import CustomSelect from '../common/CustomSelect';
import { UserControl, useTenantUsers } from '../../features/controls/plugins/UserControl';
import { PhoneControl } from '../../features/controls/plugins/PhoneControl';
import { EmailControl } from '../../features/controls/plugins/EmailControl';
import { LatLngControl } from '../../features/controls/plugins/LatLngControl';
import { DetailFieldInput } from '../../features/controls/DetailFieldControl';
import { useDateTimePrefs, isSystemDateTimeField, formatSystemDateTimeValue } from '../../utils/systemDateTime';
import { renderListFieldValue, resolveLabel, getVisibleColumns, type RuntimeSortRule } from './ListViewTable';
import { useI18nLocale } from '../../contexts/I18nContext';
import './ListViewMobile.css';

export interface ListViewMobileProps {
  config?: any;
  fields: SailsFieldDefinition[];
  records: any[];
  totalRecords: number;
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
  onPrimaryLinkClick?: (rec: any, col: any, cellText: string) => void;
  title?: string;
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
  formError?: string;
  allowInlineDelete?: boolean;
  confirmDeleteId?: string | null;
  deletingRow?: boolean;
  onRequestDelete?: (rec: any) => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  mobileViewMode?: 'accordion' | 'card';
  actions?: { label: string; variant: string; iconName: string; onClick: () => void }[];
}

const LIST_PER_PAGE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

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

export const ListViewMobile: React.FC<ListViewMobileProps> = ({
  config,
  fields,
  records,
  totalRecords,
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
  selectedIndices = new Set(),
  onSelectionChange = () => {},
  onPrimaryLinkClick,
  title,
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
  mobileViewMode = 'accordion',
  actions = [],
}) => {
  const datetimePrefs = useDateTimePrefs();
  const { users: tenantUsers } = useTenantUsers();

  const userDisplayName = useCallback((value: any): string => {
    if (typeof value === 'object' && value) return value?.name || value?.email || value?.id || '';
    const str = String(value ?? '').trim();
    if (!str) return '';
    const u = tenantUsers.find((x) => x.id === str || x.name === str || x.email === str);
    return u?.name || str;
  }, [tenantUsers]);

  const allowMultiSelect = config?.allowMultiSelect ?? true;
  const allowPaging = config?.allowPaging ?? true;
  const pagingMode = config?.pagingMode || 'dynamic';
  const inlineEnabled = allowInlineEdit;

  const { locale } = useI18nLocale();
  const visibleColumns = useMemo(() => getVisibleColumns(config, fields), [config, fields]);
  const primaryCol = useMemo(
    () => visibleColumns.find((c: any) => c.isPrimaryLink) || visibleColumns[0],
    [visibleColumns]
  );

  const totalPages = useMemo(() => {
    if (!allowPaging) return 1;
    return Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  }, [allowPaging, totalRecords, recordsPerPage]);
  const safePage = useMemo(() => Math.max(1, Math.min(page, totalPages)), [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
        if (items.length > 0 && p - (items[items.length - 1] as number) > 1) items.push('ellipsis');
        items.push(p);
      }
    }
    return items;
  }, [totalPages, safePage]);

  const handleRuntimeSort = (colFieldId: string) => {
    onSortRulesChange((() => {
      const idx = sortRules.findIndex((r) => r.fieldId === colFieldId);
      if (idx === -1) return [...sortRules, { fieldId: colFieldId, direction: 'asc' as const }];
      if (sortRules[idx].direction === 'asc') {
        const next = [...sortRules];
        next[idx] = { fieldId: colFieldId, direction: 'desc' as const };
        return next;
      }
      return sortRules.filter((r) => r.fieldId !== colFieldId);
    })());
  };

  const toggleSelectRecord = (globalIdx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(globalIdx)) next.delete(globalIdx);
    else next.add(globalIdx);
    onSelectionChange(next);
  };

  const renderEditorCell = (f: SailsFieldDefinition, draft: Record<string, any> | undefined, errors: Record<string, string[]> | undefined) => (
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

  const renderCellValue = useCallback((f: SailsFieldDefinition, rec: any) => {
    const val = rec[f.fieldName];
    if (isSystemDateTimeField(f)) return formatSystemDateTimeValue(val ?? rec[f.id], datetimePrefs);
    if (f.logicalType === 'user') return userDisplayName(val ?? rec[f.id]);
    return renderListFieldValue(f, rec);
  }, [datetimePrefs, userDisplayName]);

  const renderCellNode = useCallback((f: SailsFieldDefinition, rec: any) => {
    if (f.logicalType === 'user') return <UserControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />;
    if (f.logicalType === 'phone') return <PhoneControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />;
    if (f.logicalType === 'email') return <EmailControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />;
    if (f.logicalType === 'lat_lng') return <LatLngControl.RenderDisplay field={f} value={rec[f.fieldName] ?? rec[f.id]} />;
    return renderCellValue(f, rec);
  }, [renderCellValue]);

  const renderPrimaryValue = useCallback((rec: any, col: any) => {
    if (!col || !col.fieldId) {
      const firstKey = Object.keys(rec || {}).find(k => k !== 'id' && k !== 'tenant_id' && !k.startsWith('_'));
      return firstKey ? (rec[firstKey] ?? '\u2014') : (rec?.name || rec?.id || '\u2014');
    }
    const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
    if (!f) return rec[col.fieldId] ?? '\u2014';
    return renderCellValue(f, rec);
  }, [fields, renderCellValue]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [cardIndex, setCardIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const cardOffset = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const delta = touchCurrentX.current - touchStartX.current;
    cardOffset.current = delta;
    (e.currentTarget as HTMLElement).style.transform = `translateX(${delta}px)`;
    (e.currentTarget as HTMLElement).style.transition = 'none';
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = cardOffset.current;
    cardOffset.current = 0;
    const el = e.currentTarget as HTMLElement;
    el.style.transition = 'transform 0.25s ease';
    el.style.transform = '';
    if (delta < -50 && cardIndex < records.length - 1) setCardIndex((i) => i + 1);
    else if (delta > 50 && cardIndex > 0) setCardIndex((i) => i - 1);
  };

  const goToCard = (idx: number) => {
    if (idx >= 0 && idx < records.length) setCardIndex(idx);
  };

  const currentRecord = records[cardIndex] || null;

  const renderInlineActions = (
    saving: boolean,
    onSave: (() => void) | undefined,
    onCancel: (() => void) | undefined
  ) => (
    <div className="lvm-inline-actions">
      <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={onSave} disabled={saving} title="Save">
        {saving ? <Loader2 size={13} className="ls-spin" /> : <Check size={13} />}
      </button>
      <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onCancel} disabled={saving} title="Cancel">
        <X size={13} />
      </button>
    </div>
  );

  const renderFieldRow = (f: SailsFieldDefinition, rec: any, col: any, isEditing: boolean, draft?: Record<string, any>, errors?: Record<string, string[]>) => (
    <div key={f.fieldName} className="lvm-field-row">
      <span className="lvm-field-label">{resolveLabel(col, fields, locale)}</span>
      <div className="lvm-field-value">
        {isEditing && !isSystemField(f.fieldName) ? (
          renderEditorCell(f, draft, errors)
        ) : (
          renderCellNode(f, rec)
        )}
      </div>
    </div>
  );

  const renderPagination = () => {
    if (!allowPaging || totalRecords <= 0) return null;
    return (
      <div className="ls-pagination">
        <div className="ls-pagination__info">
          <span className="ls-pagination__range">
            Showing <strong>{(safePage - 1) * recordsPerPage + 1}</strong> to <strong>{Math.min(safePage * recordsPerPage, totalRecords)}</strong> of <strong>{totalRecords}</strong>
          </span>
          {pagingMode === 'dynamic' && (
            <div className="ls-pagination__page-size">
              <span className="ls-pagination__page-size-label">Per page:</span>
              <CustomSelect value={recordsPerPage} options={LIST_PER_PAGE_OPTIONS}
                onChange={(v: number) => { onRecordsPerPageChange(v); }} size="sm" direction="up" />
            </div>
          )}
        </div>
        <div className="ls-pagination__controls">
          <button type="button" className="ls-pagination__btn" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
            <ChevronLeft size={14} />
          </button>
          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? <span key={`e-${i}`} className="ls-pagination__ellipsis">...</span>
              : safePage === p
                ? <span key={p} className="ls-pagination-page ls-pagination-page--active">{p}</span>
                : <button key={p} type="button" className="ls-pagination-page ls-pagination-page--clickable" onClick={() => onPageChange(p)}>{p}</button>
          )}
          <button type="button" className="ls-pagination__btn" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderToolbar = () => (
    <div className="lvm-toolbar">
      {title && <span className="lvm-toolbar__title">{title}</span>}
      <span className="lvm-toolbar__count">{totalRecords} records</span>
      {sortRules.length > 0 && (
        <button type="button" className="ls-block__btn" onClick={() => onSortRulesChange([])} title="Reset sort">
          <ArrowUpDown size={12} />
        </button>
      )}
      {actions.length > 0 && (
        <div className="lvm-toolbar__actions">
          {actions.map((act, i) => {
            const variantClass = act.variant === 'primary' ? 'sails-btn--primary'
              : act.variant === 'danger' ? 'sails-btn--danger'
              : act.variant === 'secondary' ? 'sails-btn--secondary'
              : 'sails-btn--ghost';
            return (
              <button key={i} type="button" className={`sails-btn ${variantClass} sails-btn--sm`} onClick={act.onClick}>
                {act.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (records.length === 0 && !creatingRow) {
    return (
      <div className="ls-table-card">
        {renderToolbar()}
        <div className="lvm-empty">
          {formError && <div className="lvm-form-error">{formError}</div>}
          <p className="ls-empty">No records found.</p>
        </div>
        {renderPagination()}
      </div>
    );
  }

  const flyoverClass = creatingRow || editingRowId || activePreviewFilter ? 'lvm-root--flyover' : '';

  return (
    <div className={`ls-table-card lvm-root ${flyoverClass}`}>
      {renderToolbar()}
      {formError && <div className="lvm-form-error">{formError}</div>}

      {creatingRow && (
        <div className="lvm-create-card">
          <div className="lvm-create-card__header">New Record</div>
          <div className="lvm-create-card__fields">
            {visibleColumns.map((col: any) => {
              const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
              if (!f || isSystemField(f.fieldName)) return null;
              return renderFieldRow(f, {}, col, true, createDraft, createErrors);
            })}
          </div>
          <div className="lvm-create-card__actions">
            {renderInlineActions(savingCreate, onCreateSave, onCreateCancel)}
          </div>
        </div>
      )}

      {mobileViewMode === 'accordion' && (
        <div className="lvm-accordion">
          {records.map((rec, ri) => {
            const isExpanded = expandedId === rec.id;
            const isEditingRow = inlineEnabled && editingRowId === rec.id;
            const isDeleting = confirmDeleteId === rec.id;
            return (
              <div
                key={rec.id || ri}
                className={`lvm-accordion-item ${isExpanded ? 'lvm-accordion-item--open' : ''} ${isEditingRow ? 'lvm-accordion-item--editing' : ''}`}
              >
                <div
                  className="lvm-accordion-header"
                  onClick={() => { if (!isEditingRow) setExpandedId(isExpanded ? null : rec.id); }}
                >
                  {allowMultiSelect && (
                    <span onClick={(e) => { e.stopPropagation(); toggleSelectRecord(ri); }}>
                      <input type="checkbox" checked={selectedIndices.has(ri)} readOnly className="lvm-checkbox" />
                    </span>
                  )}
                  <span className="lvm-accordion-primary">
                    {onPrimaryLinkClick ? (
                      <a href={`#record-${rec.id}`} className="ls-primary-link"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPrimaryLinkClick(rec, primaryCol, String(renderPrimaryValue(rec, primaryCol))); }}>
                        {renderPrimaryValue(rec, primaryCol)}
                      </a>
                    ) : (
                      <span>{renderPrimaryValue(rec, primaryCol)}</span>
                    )}
                  </span>
                  {!isEditingRow && (
                    <span className="lvm-accordion-chevron">
                      <ChevronDown size={14} className={`lvm-chevron-icon ${isExpanded ? 'lvm-chevron-icon--open' : ''}`} />
                    </span>
                  )}
                </div>
                <div className={`lvm-accordion-body ${isExpanded ? 'lvm-accordion-body--open' : ''}`}>
                  <div className="lvm-accordion-content">
                    {!isEditingRow && !isDeleting && (inlineEnabled || allowInlineDelete) && (
                      <div className="lvm-accordion-row-actions">
                        {allowInlineEdit && (
                          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => onStartEdit && onStartEdit(rec)}><Pencil size={13} /> Edit</button>
                        )}
                        {allowInlineDelete && (
                          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" style={{ color: 'var(--sails-danger)' }} onClick={() => onRequestDelete && onRequestDelete(rec)}><Trash2 size={13} /> Delete</button>
                        )}
                      </div>
                    )}
                    {isDeleting && (
                      <div className="lvm-accordion-row-actions">
                        <span className="lvm-confirm-text">Delete this record?</span>
                        <button type="button" className="sails-btn sails-btn--danger sails-btn--sm" onClick={onConfirmDelete} disabled={deletingRow}>
                          {deletingRow ? <Loader2 size={13} className="ls-spin" /> : 'Confirm'}
                        </button>
                        <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onCancelDelete} disabled={deletingRow}><X size={13} /> Cancel</button>
                      </div>
                    )}
                    {isEditingRow ? (
                      <div className="lvm-accordion-edit-fields">
                        {visibleColumns.map((col: any) => {
                          const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                          if (!f) return null;
                          return renderFieldRow(f, rec, col, true, editDraft, editErrors);
                        })}
                        <div className="lvm-accordion-row-actions">
                          {renderInlineActions(savingRow, onSaveEdit, onCancelEdit)}
                        </div>
                      </div>
                    ) : (
                      visibleColumns.map((col: any) => {
                        const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                        if (!f) return null;
                        return renderFieldRow(f, rec, col, false);
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mobileViewMode === 'card' && currentRecord && (
        <div className="lvm-card-wrap">
          <div
            className={`lvm-card ${editingRowId === currentRecord.id ? 'lvm-card--editing' : ''}`}
            onTouchStart={editingRowId === currentRecord.id ? undefined : handleTouchStart}
            onTouchMove={editingRowId === currentRecord.id ? undefined : handleTouchMove}
            onTouchEnd={editingRowId === currentRecord.id ? undefined : handleTouchEnd}
          >
            <div className="lvm-card__header">
              {allowMultiSelect && (
                <input type="checkbox" checked={selectedIndices.has(cardIndex)}
                  onChange={() => toggleSelectRecord(cardIndex)} className="lvm-checkbox" />
              )}
              <div className="lvm-card__primary">
                {onPrimaryLinkClick ? (
                  <a href={`#record-${currentRecord.id}`} className="ls-primary-link"
                    onClick={(e) => { e.preventDefault(); onPrimaryLinkClick(currentRecord, primaryCol, String(renderPrimaryValue(currentRecord, primaryCol))); }}>
                    {renderPrimaryValue(currentRecord, primaryCol)}
                  </a>
                ) : (
                  <span>{renderPrimaryValue(currentRecord, primaryCol)}</span>
                )}
              </div>
            </div>
            <div className="lvm-card__fields">
              {editingRowId === currentRecord.id ? (
                <>
                  {visibleColumns.map((col: any) => {
                    const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                    if (!f) return null;
                    return renderFieldRow(f, currentRecord, col, true, editDraft, editErrors);
                  })}
                </>
              ) : confirmDeleteId === currentRecord.id ? (
                <div className="lvm-card__delete-confirm">
                  <p>Delete this record permanently?</p>
                  <div className="lvm-inline-actions">
                    <button type="button" className="sails-btn sails-btn--danger sails-btn--sm" onClick={onConfirmDelete} disabled={deletingRow}>
                      {deletingRow ? <Loader2 size={13} className="ls-spin" /> : <Trash2 size={13} />} Delete
                    </button>
                    <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onCancelDelete} disabled={deletingRow}><X size={13} /> Cancel</button>
                  </div>
                </div>
              ) : (
                visibleColumns.map((col: any) => {
                  const f = fields.find((ff) => ff.id === col.fieldId || ff.fieldName === col.fieldId);
                  if (!f) return null;
                  return renderFieldRow(f, currentRecord, col, false);
                })
              )}
            </div>
            <div className="lvm-card__actions">
              {editingRowId === currentRecord.id ? (
                renderInlineActions(savingRow, onSaveEdit, onCancelEdit)
              ) : confirmDeleteId === currentRecord.id ? null : (
                <>
                  {allowInlineEdit && (
                    <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => onStartEdit && onStartEdit(currentRecord)}><Pencil size={13} /> Edit</button>
                  )}
                  {allowInlineDelete && (
                    <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" style={{ color: 'var(--sails-danger)' }} onClick={() => onRequestDelete && onRequestDelete(currentRecord)}><Trash2 size={13} /> Delete</button>
                  )}
                </>
              )}
            </div>
          </div>
          {records.length > 1 && (
            <div className="lvm-card-dots">
              {records.map((_, i) => (
                <button
                  key={i}
                  className={`lvm-card-dot ${i === cardIndex ? 'lvm-card-dot--active' : ''}`}
                  onClick={() => goToCard(i)}
                />
              ))}
            </div>
          )}
          <div className="lvm-card-nav">
            <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" disabled={cardIndex <= 0}
              onClick={() => goToCard(cardIndex - 1)}><ChevronLeft size={14} /></button>
            <span className="lvm-card-nav__pos">{cardIndex + 1} / {records.length}</span>
            <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" disabled={cardIndex >= records.length - 1}
              onClick={() => goToCard(cardIndex + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {renderPagination()}
    </div>
  );
};

export default ListViewMobile;
