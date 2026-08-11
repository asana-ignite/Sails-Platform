/**
 * MOCK UP — Table View Builder (LIST layout editor)
 *
 * Designed to integrate into Layout Studio as the viewType='LIST' mode.
 * Replaces the sections/blocks WYSIWYG canvas with a column picker +
 * filter builder + table preview for building saved list views.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2,
  LayoutGrid, Settings, ArrowRight, Columns,
  Filter, ArrowUpDown, Play, Pause, Minimize2, Maximize2,
  Layers, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ArrowLeft, RotateCcw, AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { MOCK_LEADS_FIELDS } from './sample-layout-data';
import { CustomSelect } from '../../components/common/CustomSelect';
import SailsPopover from '../../components/common/SailsPopover';
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
  allowSorting: boolean;
  allowFiltering: boolean;
  alignment?: 'left' | 'center' | 'right';
  wrapText?: boolean;
}

interface LayoutFilter {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: string;
  logic: 'and' | 'or';
}

interface LayoutSortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
}

interface SummaryField {
  id: string;
  fieldId: string;
}

// ─── Mock Data ────────────────────────────────────────────────

const MOCK_RECORDS: Record<string, any>[] = [
  { lead_name: 'ACME Corp Deal', company: 'ACME Corporation', email: 'j.doe@acme.com', phone: '+66 2 123 4567', status: 'qualified', source: 'website', budget: 250000, contact_date: '2026-06-15', notes: 'Met at Tech Summit.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Beta Inc Partnership', company: 'Beta Inc', email: 'p.smith@beta.com', phone: '+66 81 234 5678', status: 'new', source: 'referral', budget: 50000, contact_date: '2026-07-01', notes: 'Referred by Jane.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Gamma Ltd Contract', company: 'Gamma Ltd', email: 't.lee@gamma.com', phone: '+66 89 876 5432', status: 'contacted', source: 'event', budget: 150000, contact_date: '2026-07-10', notes: 'Bangkok Tech Week.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Delta Co Inquiry', company: 'Delta Co', email: 'w.brown@delta.com', phone: '+66 3 456 7890', status: 'lost', source: 'website', budget: 75000, contact_date: '2026-06-20', notes: 'Went with competitor.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Epsilon Solutions', company: 'Epsilon Co Ltd', email: 'm.davis@epsilon.com', phone: '+66 4 567 8901', status: 'qualified', source: 'website', budget: 500000, contact_date: '2026-07-20', notes: 'Large enterprise deal.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Zeta Holdings', company: 'Zeta Group', email: 'k.wong@zeta.com', phone: '+66 5 678 9012', status: 'new', source: 'cold_call', budget: 120000, contact_date: '2026-07-25', notes: 'Initial cold outreach.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Eta Enterprises', company: 'Eta Co', email: 'r.jones@eta.com', phone: '+66 6 789 0123', status: 'qualified', source: 'event', budget: 380000, contact_date: '2026-06-28', notes: 'Very interested in premium tier.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Theta Logistics', company: 'Theta Transport', email: 'a.patel@theta.com', phone: '+66 7 890 1234', status: 'contacted', source: 'referral', budget: 90000, contact_date: '2026-07-15', notes: 'Follow up next week.', assigned_to: 'Pranee Srisuk' },
  { lead_name: 'Iota Manufacturing', company: 'Iota Industrial', email: 'c.garcia@iota.com', phone: '+66 8 901 2345', status: 'lost', source: 'website', budget: 200000, contact_date: '2026-05-10', notes: 'Budget constraints.', assigned_to: 'Pranee Srisuk' },
  { lead_name: 'Kappa Finance', company: 'Kappa Capital', email: 'l.chen@kappa.com', phone: '+66 9 012 3456', status: 'qualified', source: 'cold_call', budget: 750000, contact_date: '2026-07-22', notes: 'Enterprise banking needs.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Lambda Tech', company: 'Lambda Innovations', email: 'd.kim@lambda.com', phone: '+66 10 123 4567', status: 'new', source: 'website', budget: 45000, contact_date: '2026-07-28', notes: 'Trial signup.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Mu Retail', company: 'Mu Trading', email: 's.nguyen@mu.com', phone: '+66 11 234 5678', status: 'contacted', source: 'event', budget: 180000, contact_date: '2026-07-05', notes: 'Trade show lead.', assigned_to: 'Pranee Srisuk' },
  { lead_name: 'Nu Healthcare', company: 'Nu Medical', email: 'h.tan@nu.com', phone: '+66 12 345 6789', status: 'qualified', source: 'referral', budget: 420000, contact_date: '2026-06-22', notes: 'Compliance review required.', assigned_to: 'Somsak Chaiyaporn' },
  { lead_name: 'Xi Construction', company: 'Xi Builders', email: 'g.ali@xi.com', phone: '+66 13 456 7890', status: 'new', source: 'cold_call', budget: 310000, contact_date: '2026-07-18', notes: 'Large project pipeline.', assigned_to: 'Anong Kongkaew' },
  { lead_name: 'Omicron Energy', company: 'Omicron Power', email: 'f.yuki@omicron.com', phone: '+66 14 567 8901', status: 'lost', source: 'website', budget: 900000, contact_date: '2026-04-30', notes: 'Regulatory issues.', assigned_to: 'Pranee Srisuk' },
];

// ─── Helpers ──────────────────────────────────────────────────

let colCounter = 0;
function colId(): string { colCounter++; return `col_${Date.now()}_${colCounter}`; }

let filtCounter = 0;
function filtId(): string { filtCounter++; return `filt_${Date.now()}_${filtCounter}`; }

let summCounter = 0;
function summId(): string { summCounter++; return `summ_${Date.now()}_${summCounter}`; }

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

const PER_PAGE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

// ─── Default Columns ──────────────────────────────────────────

function buildDefaultColumns(): LayoutColumn[] {
  colCounter = 0;
  return [
    { id: colId(), fieldId: 'f_001', position: 0, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false },
    { id: colId(), fieldId: 'f_002', position: 1, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false },
    { id: colId(), fieldId: 'f_003', position: 2, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false },
    { id: colId(), fieldId: 'f_005', position: 3, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false },
    { id: colId(), fieldId: 'f_006', position: 4, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false },
  ];
}

// ─── Component ────────────────────────────────────────────────

const TableBuilder: React.FC = () => {
  const allFields = MOCK_LEADS_FIELDS;
  /** Per-column header refs, used to anchor the filter popovers. */
  const filterThRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  const [viewName, setViewName] = useState('Default List View');
  const [columns, setColumns] = useState<LayoutColumn[]>(buildDefaultColumns);
  const [filters, setFilters] = useState<LayoutFilter[]>([
    { id: filtId(), fieldId: 'f_005', operator: 'eq', value: 'qualified', logic: 'and' },
  ]);
  const [sortRules, setSortRules] = useState<LayoutSortRule[]>([
    { fieldId: 'f_008', direction: 'desc' },
  ]);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [summaryFields, setSummaryFields] = useState<SummaryField[]>([]);
  const [overlayMode, setOverlayMode] = useState<'edit-sort' | 'edit-filter' | null>(null);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [runtimeSortRules, setRuntimeSortRules] = useState<LayoutSortRule[]>([]);
  const [runtimeFilters, setRuntimeFilters] = useState<Record<string, string>>({});
  const [activePreviewFilter, setActivePreviewFilter] = useState<string | null>(null);
  const [viewAllowMultiSelect, setViewAllowMultiSelect] = useState(false);
  const [viewAllowPaging, setViewAllowPaging] = useState(false);
  const [viewRecordsPerPage, setViewRecordsPerPage] = useState(25);
  const [viewPagingMode, setViewPagingMode] = useState<'fixed' | 'dynamic'>('fixed');
  const [runtimeSelectedIndices, setRuntimeSelectedIndices] = useState<Set<number>>(new Set());
  const [runtimeCurrentPage, setRuntimeCurrentPage] = useState(1);
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

  const editingFilter = useMemo(
    () => (editingFilterId ? filters.find((f) => f.id === editingFilterId) ?? null : null),
    [filters, editingFilterId]
  );

  // ─── Column Actions ───

  const addColumn = (fieldId: string) => {
    const col: LayoutColumn = {
      id: colId(),
      fieldId,
      position: columns.length,
      visible: true,
      allowSorting: false,
      allowFiltering: false,
      alignment: 'left',
      wrapText: false,
    };
    setColumns((c) => [...c, col]);
    setSelectedColumnId(col.id);
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
    setFilters((prev) => [...prev, f]);
    setEditingFilterId(f.id);
    setOverlayMode('edit-filter');
    setSelectedColumnId(null);
  };

  const removeFilter = (filterId: string) => {
    setFilters((f) => f.filter((flt) => flt.id !== filterId));
    if (editingFilterId === filterId) {
      setEditingFilterId(null);
      setOverlayMode(null);
    }
  };

  const updateFilter = (filterId: string, patch: Partial<LayoutFilter>) => {
    setFilters((f) =>
      f.map((flt) => (flt.id === filterId ? { ...flt, ...patch } : flt))
    );
  };

  // ─── Sort Actions ───

  const MAX_SORT_RULES = 3;

  const addSortRule = () => {
    setSortRules((prev) => {
      if (prev.length >= MAX_SORT_RULES) return prev;
      const usedFieldIds = prev.map((r) => r.fieldId);
      const nextField = allFields.find((f) => !usedFieldIds.includes(f.id));
      return [...prev, { fieldId: nextField?.id || allFields[0]?.id || '', direction: 'asc' as const }];
    });
  };

  const removeSortRule = (index: number) => {
    setSortRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSortRule = (index: number, patch: Partial<LayoutSortRule>) => {
    setSortRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const moveSortRule = (index: number, direction: 'up' | 'down') => {
    setSortRules((prev) => {
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next;
    });
  };

  // ─── Summary Actions ───

  const addSummaryField = (fieldId: string) => {
    if (summaryFields.some((sf) => sf.fieldId === fieldId)) return;
    setSummaryFields((prev) => [...prev, { id: summId(), fieldId }]);
  };

  const removeSummaryField = (fieldId: string) => {
    setSummaryFields((prev) => prev.filter((sf) => sf.fieldId !== fieldId));
  };

  const handleSummaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'));
      if (payload.type === 'field' && payload.fieldId) {
        addSummaryField(payload.fieldId);
      }
    } catch { /* ignore */ }
  };

  // ─── Overlay Actions ───

  const openFilterEditor = (filterId: string) => {
    setOverlayMode('edit-filter');
    setEditingFilterId(filterId);
    setSelectedColumnId(null);
  };

  const openSortEditor = () => {
    setOverlayMode('edit-sort');
    setSelectedColumnId(null);
  };

  const closeOverlay = () => {
    setOverlayMode(null);
    setEditingFilterId(null);
  };

  // ─── Reset ───

  const doReset = () => {
    setViewName('Default List View');
    setColumns(buildDefaultColumns());
    setFilters([{ id: filtId(), fieldId: 'f_005', operator: 'eq', value: 'qualified', logic: 'and' }]);
    setSortRules([{ fieldId: 'f_008', direction: 'desc' }]);
    setSelectedColumnId(null);
    setSummaryFields([]);
    setOverlayMode(null);
    setEditingFilterId(null);
    setRuntimeSortRules([]);
    setRuntimeFilters({});
    setActivePreviewFilter(null);
    setViewAllowMultiSelect(false);
    setViewAllowPaging(false);
    setViewRecordsPerPage(25);
    setViewPagingMode('fixed');
    setRuntimeSelectedIndices(new Set());
    setRuntimeCurrentPage(1);
    setPaletteFloating(false);
    setPropsFloating(false);
    setShowResetConfirm(false);
    colCounter = 0;
    filtCounter = 0;
    summCounter = 0;
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
  }, [filters, allFields]);

  const sortedRecords = useMemo(() => {
    if (sortRules.length === 0) return filteredRecords;
    return [...filteredRecords].sort((a, b) => {
      for (const rule of sortRules) {
        const sf = allFields.find((f) => f.id === rule.fieldId);
        if (!sf) continue;
        const av = a[sf.fieldName];
        const bv = b[sf.fieldName];
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [filteredRecords, sortRules, allFields]);

  const visibleColumns = sortedColumns.filter((c) => c.visible);

  const runtimeRecords = useMemo(() => {
    let records = filteredRecords;

    Object.entries(runtimeFilters).forEach(([fieldId, filterText]) => {
      if (!filterText.trim()) return;
      const field = allFields.find((f) => f.id === fieldId);
      if (!field) return;
      const lower = filterText.toLowerCase();
      records = records.filter((rec) => {
        const val = rec[field.fieldName];
        return String(val ?? '').toLowerCase().includes(lower);
      });
    });

    if (runtimeSortRules.length > 0) {
      const activeRules = runtimeSortRules;
      records = [...records].sort((a, b) => {
        for (const rule of activeRules) {
          const col = columns.find((c) => c.fieldId === rule.fieldId);
          if (!col) continue;
          const sf = allFields.find((f) => f.id === rule.fieldId);
          if (!sf) continue;
          const av = a[sf.fieldName];
          const bv = b[sf.fieldName];
          if (av == null && bv == null) continue;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    } else {
      records = sortedRecords;
    }

    return records;
  }, [filteredRecords, sortedRecords, runtimeSortRules, runtimeFilters, columns, allFields]);

  const handleRuntimeSort = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    const fieldId = col.fieldId;

    setRuntimeSortRules((prev) => {
      if (prev.length > 0 && prev[0].fieldId === fieldId) {
        if (prev[0].direction === 'asc') return [{ fieldId, direction: 'desc' }];
        return [];
      }
      return [{ fieldId, direction: 'asc' }];
    });
  };

  const handleRuntimeFilter = (fieldId: string, value: string) => {
    setRuntimeFilters((prev) => ({ ...prev, [fieldId]: value }));
  };

  const totalPages = useMemo(() => {
    if (!viewAllowPaging) return 1;
    return Math.max(1, Math.ceil(runtimeRecords.length / viewRecordsPerPage));
  }, [viewAllowPaging, runtimeRecords.length, viewRecordsPerPage]);

  const safeCurrentPage = useMemo(() => {
    if (runtimeCurrentPage > totalPages) return totalPages;
    return runtimeCurrentPage;
  }, [runtimeCurrentPage, totalPages]);

  const currentPageRecords = useMemo(() => {
    if (!viewAllowPaging) return runtimeRecords;
    const start = (safeCurrentPage - 1) * viewRecordsPerPage;
    return runtimeRecords.slice(start, start + viewRecordsPerPage);
  }, [viewAllowPaging, runtimeRecords, safeCurrentPage, viewRecordsPerPage]);

  const allSelectedOnPage = useMemo(() => {
    if (currentPageRecords.length === 0) return false;
    return currentPageRecords.every((_, i) => runtimeSelectedIndices.has(i));
  }, [currentPageRecords, runtimeSelectedIndices]);

  const toggleSelectRecord = (rowIndex: number) => {
    setRuntimeSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setRuntimeSelectedIndices((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        currentPageRecords.forEach((_, i) => next.delete(i));
      } else {
        currentPageRecords.forEach((_, i) => next.add(i));
      }
      return next;
    });
  };

  const goToPage = (page: number) => {
    setRuntimeCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  const pageNumbers = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1) {
        if (items.length > 0 && p - (items[items.length - 1] as number) > 1) {
          items.push('ellipsis');
        }
        items.push(p);
      }
    }
    return items;
  }, [totalPages, safeCurrentPage]);

  const operatorLabel = (op: FilterOperator): string => {
    const labels: Record<FilterOperator, string> = {
      eq: '=', neq: '\u2260', gt: '>', gte: '\u2265', lt: '<', lte: '\u2264',
      contains: 'contains', is_empty: 'is empty', is_not_empty: 'is not empty',
    };
    return labels[op];
  };

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
            <div className="tb-page" onClick={(e) => { if (e.target === e.currentTarget) setSelectedColumnId(null); }}>
              {/* ── Summary Panel ── */}
              <div className="tb-card tb-summary-panel">
                <div className="tb-card__header">
                  <Layers size={13} />
                  <span className="tb-card__title">Summary Panel</span>
                  {summaryFields.length > 0 && (
                    <span className="tb-card__badge">{summaryFields.length}</span>
                  )}
                </div>
                <div
                  className="tb-summary-panel__body"
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={handleSummaryDrop}
                >
                  {summaryFields.length === 0 ? (
                    <div className="tb-summary-panel__placeholder">
                      <Layers size={18} className="tb-summary-panel__placeholder-icon" />
                      <span>Drag fields here to group or summarize</span>
                    </div>
                  ) : (
                    <div className="tb-summary-fields">
                      {summaryFields.map((sf) => {
                        const f = allFields.find((ff) => ff.id === sf.fieldId);
                        if (!f) return null;
                        return (
                          <div key={sf.id} className="tb-summary-field">
                            <span className="tb-summary-field__name">{f.name}</span>
                            <span className="tb-summary-field__tag">Group By</span>
                            <button
                              className="tb-block__btn tb-block__btn--danger"
                              onClick={() => removeSummaryField(sf.fieldId)}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Columns + Table ── */}
              <div className="tb-card">
                <div className="tb-card__header">
                  <Columns size={13} />
                  <span className="tb-card__title">{previewMode ? viewName : 'Columns'}</span>
                  {!previewMode && (
                    <>
                      <span className="tb-card__badge">{columns.length}</span>
                      <span style={{ fontSize: 11, color: 'var(--sails-text-muted)', marginLeft: 4 }}>
                        ({visibleColumns.length} visible)
                      </span>
                    </>
                  )}
                  <span className="tb-card__badge" style={{ marginLeft: 'auto' }}>
                    {previewMode ? runtimeRecords.length : sortedRecords.length} rows
                  </span>
                  {previewMode && viewAllowMultiSelect && runtimeSelectedIndices.size > 0 && (
                    <span className="tb-card__badge" style={{ background: 'rgba(157, 206, 224, 0.25)', color: 'var(--sails-primary)' }}>
                      {runtimeSelectedIndices.size} selected
                    </span>
                  )}
                  {previewMode && runtimeSortRules.length > 0 && (
                    <button
                      className="tb-block__btn"
                      onClick={() => setRuntimeSortRules([])}
                      title="Reset sort"
                      style={{ marginLeft: 4 }}
                    >
                      <RotateCcw size={11} />
                    </button>
                  )}
                </div>
                <div className="tb-card__body" style={{ padding: 0 }}>
                  {columns.length === 0 ? (
                    <div style={{ padding: 16 }}>
                      <p className="tb-empty">No columns added. Click a field from the palette.</p>
                    </div>
                  ) : previewMode ? (
                    /* ── Runtime Preview Table ── */
                    <div className="tb-preview-wrap">
                      <table className="tb-runtime-table">
                        <thead>
                          <tr>
                            {viewAllowMultiSelect && (
                              <th className="tb-rth tb-rth--cb" style={{ width: 40, minWidth: 40 }}>
                                <div className="tb-rth__inner" style={{ justifyContent: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={currentPageRecords.length > 0 && allSelectedOnPage}
                                    ref={(el) => {
                                      if (el) el.indeterminate = !allSelectedOnPage && currentPageRecords.some((_, i) => runtimeSelectedIndices.has(i));
                                    }}
                                    onChange={toggleSelectAll}
                                    title="Select all on page"
                                  />
                                </div>
                              </th>
                            )}
                            {sortedColumns.filter((c) => c.visible).map((col) => {
                              const f = allFields.find((ff) => ff.id === col.fieldId);
                              if (!f) return null;
                              const runtimeSortIdx = runtimeSortRules.findIndex((r) => r.fieldId === col.fieldId);
                              const isSorted = runtimeSortIdx !== -1;
                              const sortDir = isSorted ? runtimeSortRules[runtimeSortIdx].direction : null;
                              const isFiltering = !!runtimeFilters[col.fieldId]?.trim();
                              return (
                                <th
                                  key={col.id}
                                  ref={(el) => { filterThRefs.current[col.id] = el; }}
                                  className={`tb-rth ${col.allowSorting ? 'tb-rth--sortable' : ''} ${isSorted ? 'tb-rth--sorted' : ''}`}
                                  style={{ ...(col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : {}), textAlign: col.alignment || 'left' }}
                                >
                                  <div className="tb-rth__inner">
                                    {col.allowSorting ? (
                                      <button
                                        className="tb-rth__sort-btn"
                                        onClick={() => handleRuntimeSort(col.id)}
                                      >
                                        <span className="tb-rth__label">{col.labelOverride || f.name}</span>
                                        <span className="tb-rth__sort-indicator">
                                          {isSorted ? (
                                            sortDir === 'asc'
                                              ? <ArrowUp size={12} />
                                              : <ArrowDown size={12} />
                                          ) : (
                                            <ArrowUpDown size={11} className="tb-rth__sort-icon" />
                                          )}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="tb-rth__label">{col.labelOverride || f.name}</span>
                                    )}
                                    {col.allowFiltering && (
                                      <div className="tb-rth__filter-wrap">
                                        <button
                                          className={`tb-rth__filter-btn ${isFiltering ? 'tb-rth__filter-btn--active' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActivePreviewFilter(
                                              activePreviewFilter === col.fieldId ? null : col.fieldId
                                            );
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
                                            className="tb-rth__filter-popover"
                                            deps={[!!runtimeFilters[col.fieldId]]}
                                            onClose={() => setActivePreviewFilter(null)}
                                          >
                                            <div onClick={(e) => e.stopPropagation()}>
                                              <input
                                                className="sails-input"
                                                value={runtimeFilters[col.fieldId] || ''}
                                                onChange={(e) => handleRuntimeFilter(col.fieldId, e.target.value)}
                                                placeholder={`Filter ${col.labelOverride || f.name}...`}
                                                autoFocus
                                                style={{ fontSize: 12, padding: '5px 8px', width: 180 }}
                                              />
                                              {runtimeFilters[col.fieldId]?.trim() && (
                                                <button
                                                  className="tb-rth__filter-clear"
                                                  onClick={() => {
                                                    handleRuntimeFilter(col.fieldId, '');
                                                    setActivePreviewFilter(null);
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
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageRecords.map((rec, ri) => {
                            const globalIndex = viewAllowPaging
                              ? (safeCurrentPage - 1) * viewRecordsPerPage + ri
                              : ri;
                            return (
                              <tr key={ri} className={`tb-rtd-row ${runtimeSelectedIndices.has(globalIndex) ? 'tb-rtd-row--selected' : ''}`}>
                                {viewAllowMultiSelect && (
                                  <td className="tb-rtd tb-rtd--cb" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={runtimeSelectedIndices.has(globalIndex)}
                                      onChange={() => toggleSelectRecord(globalIndex)}
                                    />
                                  </td>
                                )}
                                {sortedColumns.filter((c) => c.visible).map((col) => {
                                  const f = allFields.find((ff) => ff.id === col.fieldId);
                                  if (!f) return <td key={col.id} className={`tb-rtd ${col.wrapText ? 'tb-rtd--wrap' : ''}`} style={{ textAlign: col.alignment || 'left' }}>—</td>;
                                  return (
                                    <td key={col.id} className={`tb-rtd ${col.wrapText ? 'tb-rtd--wrap' : ''}`} style={{ textAlign: col.alignment || 'left' }}>
                                      {renderFieldValue(f, rec)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {runtimeRecords.length === 0 && (
                        <div style={{ padding: 32, textAlign: 'center' }}>
                          <p className="tb-empty">No records match the current filters.</p>
                        </div>
                      )}
                      {viewAllowPaging && runtimeRecords.length > 0 && (
                        <div className="tb-pagination">
                          <div className="tb-pagination__info">
                            <span className="tb-pagination__range">
                              Showing <strong>{(safeCurrentPage - 1) * viewRecordsPerPage + 1}</strong> to <strong>{Math.min(safeCurrentPage * viewRecordsPerPage, runtimeRecords.length)}</strong> of <strong>{runtimeRecords.length}</strong>
                            </span>
                            {viewPagingMode === 'dynamic' && (
                              <div className="tb-pagination__page-size">
                                <span className="tb-pagination__page-size-label">Records per page:</span>
                                <CustomSelect
                                  value={viewRecordsPerPage}
                                  options={PER_PAGE_OPTIONS}
                                  onChange={(v: number) => {
                                    setViewRecordsPerPage(v);
                                    setRuntimeCurrentPage(1);
                                  }}
                                  size="sm"
                                />
                              </div>
                            )}
                          </div>
                          <div className="tb-pagination__controls">
                            <button
                              className="tb-pagination__btn"
                              disabled={safeCurrentPage <= 1}
                              onClick={() => goToPage(safeCurrentPage - 1)}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            {pageNumbers.map((p, i) =>
                              p === 'ellipsis' ? (
                                <span key={`e-${i}`} className="tb-pagination__ellipsis">...</span>
                              ) : safeCurrentPage === p ? (
                                <span key={p} className="tb-pagination-page tb-pagination-page--active">{p}</span>
                              ) : (
                                <button
                                  key={p}
                                  className="tb-pagination-page tb-pagination-page--clickable"
                                  onClick={() => goToPage(p)}
                                >
                                  {p}
                                </button>
                              )
                            )}
                            <button
                              className="tb-pagination__btn"
                              disabled={safeCurrentPage >= totalPages}
                              onClick={() => goToPage(safeCurrentPage + 1)}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Builder Table ── */
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
                                  onClick={() => setSelectedColumnId(col.id)}
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
                                if (!f) return <td key={col.id} className={`tb-td ${!col.visible ? 'tb-td--hidden' : ''} ${col.wrapText ? 'tb-td--wrap' : ''}`} style={{ textAlign: col.alignment || 'left' }}>—</td>;
                                return (
                                  <td key={col.id} className={`tb-td ${!col.visible ? 'tb-td--hidden' : ''} ${col.wrapText ? 'tb-td--wrap' : ''}`} style={{ textAlign: col.alignment || 'left' }}>
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
                    <div className="tb-section-divider">Column Properties</div>
                    <div className="tb-prop__name">{selectedColumnField.name}</div>
                    <div className="tb-prop__type">{selectedColumnField.logicalType}</div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedColumn.allowSorting}
                          onChange={() => updateColumn(selectedColumn.id, { allowSorting: !selectedColumn.allowSorting })}
                        />
                        Allow Sorting
                      </label>
                      <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '2px 0 0 22px' }}>
                        Enables sorting on this column during runtime
                      </p>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedColumn.allowFiltering}
                          onChange={() => updateColumn(selectedColumn.id, { allowFiltering: !selectedColumn.allowFiltering })}
                        />
                        Allow Filtering
                      </label>
                      <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '2px 0 0 22px' }}>
                        Enables filtering on this column during runtime
                      </p>
                    </div>

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
                      <label className="tb-prop-label">Alignment</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className={`sails-btn sails-btn--ghost sails-btn--sm ${selectedColumn.alignment === 'left' ? 'tb-btn--active' : ''}`}
                          onClick={() => updateColumn(selectedColumn.id, { alignment: 'left' })}
                          title="Align Left"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <AlignLeft size={14} />
                        </button>
                        <button
                          className={`sails-btn sails-btn--ghost sails-btn--sm ${selectedColumn.alignment === 'center' ? 'tb-btn--active' : ''}`}
                          onClick={() => updateColumn(selectedColumn.id, { alignment: 'center' })}
                          title="Align Center"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <AlignCenter size={14} />
                        </button>
                        <button
                          className={`sails-btn sails-btn--ghost sails-btn--sm ${selectedColumn.alignment === 'right' ? 'tb-btn--active' : ''}`}
                          onClick={() => updateColumn(selectedColumn.id, { alignment: 'right' })}
                          title="Align Right"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <AlignRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={selectedColumn.wrapText || false}
                          onChange={() => updateColumn(selectedColumn.id, { wrapText: !selectedColumn.wrapText })}
                        />
                        Wrap Text
                      </label>
                      <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '2px 0 0 22px' }}>
                        {selectedColumn.wrapText ? 'Text wraps to multiple lines' : 'Truncates with ...'}
                      </p>
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
                          <ArrowLeft size={12} /> Left
                        </button>
                        <button
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          onClick={() => moveColumn(selectedColumn.id, 'down')}
                          disabled={selectedColumn.position >= columns.length - 1}
                        >
                          <ArrowRight size={12} /> Right
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
                ) : (
                  <>
                    <div className="tb-section-divider">View Properties</div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label">View Name</label>
                      <input
                        className="sails-input"
                        value={viewName}
                        onChange={(e) => setViewName(e.target.value)}
                        style={{ fontSize: 12, padding: '5px 7px' }}
                      />
                    </div>

                    <div className="tb-prop-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="tb-prop-label" style={{ marginBottom: 0 }}>Sort By</label>
                        <button
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          onClick={addSortRule}
                          disabled={sortRules.length >= MAX_SORT_RULES}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          <Plus size={11} /> Add
                        </button>
                      </div>
                      {sortRules.length === 0 ? (
                        <p className="tb-vp-empty">No sort rules configured</p>
                      ) : (
                        <div className="tb-vp-sort-list">
                          {sortRules.map((rule, idx) => {
                            const sf = allFields.find((f) => f.id === rule.fieldId);
                            return (
                              <div key={idx} className="tb-vp-sort-rule" onClick={() => openSortEditor()}>
                                <span className="tb-vp-sort-rule__seq">{idx + 1}</span>
                                <span className="tb-vp-sort-rule__field">{sf?.name || rule.fieldId}</span>
                                <span className="tb-vp-sort-rule__dir">
                                  {rule.direction === 'asc' ? '\u25B2' : '\u25BC'}
                                </span>
                                <button
                                  className="tb-vp-sort-rule__remove"
                                  onClick={(e) => { e.stopPropagation(); removeSortRule(idx); }}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="tb-prop-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <label className="tb-prop-label" style={{ marginBottom: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Filter size={12} /> Filters
                          </span>
                        </label>
                        <button
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          onClick={addFilter}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          <Plus size={11} /> Add
                        </button>
                      </div>
                      {filters.length === 0 ? (
                        <p className="tb-vp-empty">No filters applied</p>
                      ) : (
                        <div className="tb-vp-filter-list">
                          {filters.map((f, i) => {
                            const ff = allFields.find((fd) => fd.id === f.fieldId);
                            return (
                              <div
                                key={f.id}
                                className="tb-vp-filter-row"
                                onClick={() => openFilterEditor(f.id)}
                              >
                                {i > 0 && (
                                  <span className="tb-vp-filter-logic">{f.logic.toUpperCase()}</span>
                                )}
                                <span className="tb-vp-filter-field">{ff?.name || f.fieldId}</span>
                                <span className="tb-vp-filter-op">{operatorLabel(f.operator)}</span>
                                {!['is_empty', 'is_not_empty'].includes(f.operator) && (
                                  <span className="tb-vp-filter-value">{f.value || '(empty)'}</span>
                                )}
                                <button
                                  className="tb-vp-filter-remove"
                                  onClick={(e) => { e.stopPropagation(); removeFilter(f.id); }}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={viewAllowMultiSelect}
                          onChange={() => setViewAllowMultiSelect((v) => !v)}
                        />
                        Allow Multiple Selection
                      </label>
                      <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '2px 0 0 22px' }}>
                        Adds checkboxes to select records during runtime
                      </p>
                    </div>

                    <div className="tb-prop-group">
                      <label className="tb-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={viewAllowPaging}
                          onChange={() => {
                            setViewAllowPaging((v) => !v);
                            setRuntimeCurrentPage(1);
                          }}
                        />
                        Allow Paging
                      </label>
                      <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '2px 0 0 22px' }}>
                        Paginates records during runtime
                      </p>
                    </div>

                    {viewAllowPaging && (
                      <>
                        <div className="tb-prop-group" style={{ paddingLeft: 24 }}>
                          <label className="tb-prop-label" style={{ marginBottom: 6 }}>Paging Mode</label>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <label className="tb-radio-label">
                              <input
                                type="radio"
                                name="viewPagingMode"
                                checked={viewPagingMode === 'fixed'}
                                onChange={() => setViewPagingMode('fixed')}
                              />
                              Fixed
                            </label>
                            <label className="tb-radio-label">
                              <input
                                type="radio"
                                name="viewPagingMode"
                                checked={viewPagingMode === 'dynamic'}
                                onChange={() => setViewPagingMode('dynamic')}
                              />
                              Dynamic
                            </label>
                          </div>
                          <p style={{ fontSize: 10, color: 'var(--sails-text-muted)', margin: '4px 0 0' }}>
                            {viewPagingMode === 'fixed'
                              ? 'Records per page is set by the builder'
                              : 'User can select their own records per page at runtime'}
                          </p>
                        </div>

                        {viewPagingMode === 'fixed' && (
                          <div className="tb-prop-group" style={{ paddingLeft: 24 }}>
                            <label className="tb-prop-label">Records Per Page</label>
                            <CustomSelect
                              value={viewRecordsPerPage}
                              options={PER_PAGE_OPTIONS}
                              onChange={(v: number) => {
                                setViewRecordsPerPage(v);
                                setRuntimeCurrentPage(1);
                              }}
                              size="sm"
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                      </>
                    )}

                  </>
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

      {/* ── Floating Overlay for Filter/Sort Editing ── */}
      {overlayMode && (
        <div className="tb-overlay" onClick={closeOverlay}>
          <div className="tb-overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="tb-overlay-card__header">
              <h3 className="tb-overlay-card__title">
                {overlayMode === 'edit-sort' ? (
                  <><ArrowUpDown size={14} /> Edit Sort</>
                ) : (
                  <><Filter size={14} /> {editingFilterId ? 'Edit Filter' : 'Add Filter'}</>
                )}
              </h3>
              <button className="tb-block__btn" onClick={closeOverlay}>
                <X size={14} />
              </button>
            </div>
            <div className="tb-overlay-card__body">
              {overlayMode === 'edit-sort' ? (
                <>
                  {sortRules.length === 0 && (
                    <p className="tb-empty" style={{ padding: 20 }}>No sort rules configured.</p>
                  )}
                  {sortRules.map((rule, idx) => {
                    const sf = allFields.find((f) => f.id === rule.fieldId);
                    return (
                      <div key={idx} className="tb-prop-group" style={idx === 0 ? { borderTop: 'none', paddingTop: 0 } : undefined}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <label className="tb-prop-label" style={{ marginBottom: 0 }}>Rule {idx + 1}</label>
                          <button
                            className="tb-block__btn tb-block__btn--danger"
                            onClick={() => removeSortRule(idx)}
                            title="Remove sort rule"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <select
                          className="sails-input"
                          value={rule.fieldId}
                          onChange={(e) => updateSortRule(idx, { fieldId: e.target.value })}
                          style={{ fontSize: 12, padding: '5px 7px', marginBottom: 6 }}
                        >
                          {allFields.map((f) => (
                            <option key={f.id} value={f.id} disabled={sortRules.some((r, i) => i !== idx && r.fieldId === f.id)}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['asc', 'desc'] as const).map((d) => (
                            <button
                              key={d}
                              className={`tb-btn-sort ${rule.direction === d ? 'tb-btn-sort--active' : ''}`}
                              onClick={() => updateSortRule(idx, { direction: d })}
                            >
                              {d === 'asc' ? '\u25B2 ASC' : '\u25BC DESC'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="tb-prop-group">
                    <button
                      className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={addSortRule}
                      disabled={sortRules.length >= MAX_SORT_RULES}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Plus size={12} /> Add Sort Rule
                    </button>
                  </div>
                </>
              ) : editingFilter && (
                <>
                  <div className="tb-prop-group" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <label className="tb-prop-label">Field</label>
                    <select
                      className="sails-input"
                      value={editingFilter.fieldId}
                      onChange={(e) => updateFilter(editingFilter.id, { fieldId: e.target.value })}
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
                      value={editingFilter.operator}
                      onChange={(e) => updateFilter(editingFilter.id, { operator: e.target.value as FilterOperator })}
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
                  {!['is_empty', 'is_not_empty'].includes(editingFilter.operator) && (
                    <div className="tb-prop-group">
                      <label className="tb-prop-label">Value</label>
                      <input
                        className="sails-input"
                        value={editingFilter.value}
                        onChange={(e) => updateFilter(editingFilter.id, { value: e.target.value })}
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
                          className={`tb-btn-logic tb-btn-logic--large ${editingFilter.logic === l ? 'tb-btn-logic--active' : ''}`}
                          onClick={() => updateFilter(editingFilter.id, { logic: l })}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="tb-prop-group" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="sails-btn sails-btn--primary sails-btn--sm"
                      onClick={closeOverlay}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
              {overlayMode === 'edit-sort' && (
                <div className="tb-prop-group" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="sails-btn sails-btn--primary sails-btn--sm"
                    onClick={closeOverlay}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
