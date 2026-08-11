/**
 * Layout Studio — WYSIWYG Layout Designer
 *
 * Block types: field | related_list | tab_group
 * Each block is a plugin: it renders its own preview and has its own properties.
 *
 * Permission: requires SUPER_ADMIN or TENANT_ADMIN role.
 * TODO: refine when RBAC capability system supports 'layouts.design'
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDateTimePrefs, formatSystemDateTimeValue } from '../../utils/systemDateTime';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2, MoveUp, MoveDown,
  LayoutGrid, Settings, ArrowRight, ListTree, FolderKanban, Columns,
  Table2, Filter, ShieldAlert, AlertCircle, ArrowUpDown,
  ArrowLeft, Loader2, Play, Pause, Minimize2, Maximize2, CheckCircle2,
  Layers, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronDown,
  RotateCcw, AlignLeft, AlignCenter, AlignRight,
  Edit3, Zap, Undo2, Redo2, AlertTriangle, Database, ExternalLink,
  MousePointerClick, Smartphone, List, PanelRight, History,
} from 'lucide-react';
import type { SailsFieldDefinition, LayoutColumn, FilterGroup, FilterRule, LayoutSort, ViewType, SummaryField, LayoutStatus, ListAction, MobileViewMode } from '@sails/shared';
import { formatDateTimeValue, formatDecimalValue, normalizeFilters } from '@sails/shared';
import { FilterBuilder } from '../../components/common/FilterBuilder';
import DynamicIcon from '../../components/common/DynamicIcon';
import { CustomSelect } from '../../components/common/CustomSelect';
import SailsPopover from '../../components/common/SailsPopover';
import { FieldControlRegistry } from '../../features/controls/FieldControlRegistry';
import { DetailFieldInput, DetailFieldDisplay, mockFieldValue } from '../../features/controls/DetailFieldControl';
import { UserControl } from '../../features/controls/plugins/UserControl';
import { PhoneControl } from '../../features/controls/plugins/PhoneControl';
import { EmailControl } from '../../features/controls/plugins/EmailControl';
import { LatLngControl } from '../../features/controls/plugins/LatLngControl';
import type { FieldValidation, ConditionOp, ValidationType } from '../../features/controls/types';
import { ActionRegistry } from '../../features/actions';
import { useAuth } from '../../contexts/AuthContext';
import { fetchCached } from '../../api/client';
import Unauthorized from '../Unauthorized';
import './LayoutStudio.css';

// Initialise the ActionRegistry singleton once at module load
const actionRegistry = ActionRegistry.getInstance();


// ─── Types ────────────────────────────────────────────────────

type Width = number;
type BlockType = 'field' | 'related_list' | 'tab_group';

interface BlockCondition {
  id: string;
  fieldId: string;
  operator: ConditionOp;
  value: string;
  logic: 'and' | 'or';
}

interface PlacedBlock {
  id: string;
  blockType: BlockType;
  sectionId: string;
  position: number;
  width: Width;
  visible: boolean;
  fieldId?: string;
  labelOverride?: string;
  /** Legacy mock-only related block fields (pre-"Related List View"). */
  relatedTableId?: string;
  relatedDisplayFields?: string[];
  /** "Related List View" block: child model owning the FK, the FK field, and the child LIST view. */
  relatedTableName?: string;
  relatedFieldName?: string;
  relatedViewId?: string;
  relatedTableLabel?: string;
  tabs?: { id: string; label: string; sectionIds: string[]; blocks: PlacedBlock[] }[];
  conditions?: BlockCondition[];
  validations?: FieldValidation[];
  controlPluginId?: string;
}

interface BuilderSection {
  id: string;
  title: string;
  columns: number;
  showHeader?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
}

interface DragPayload {
  type: 'palette' | 'placed';
  blockType?: BlockType;
  fieldId?: string;
  paletteId?: string;
  blockId?: string;
  sourceSectionId?: string;
  sourceTabBlockId?: string;
  sourceTabId?: string;
}

interface PaletteItem {
  id: string;
  blockType: BlockType;
  label: string;
  icon: React.ReactNode;
  fieldId?: string;
  description: string;
}

interface TableMeta {
  id: string;
  name: string;
  tableName: string;
  fields: SailsFieldDefinition[];
}

// ─── Helpers ──────────────────────────────────────────────────

let sectionCounter = 0;
function newSection(): BuilderSection {
  sectionCounter++;
  return { id: `sec_${Date.now()}_${sectionCounter}`, title: `Section ${sectionCounter}`, columns: 2, showHeader: true, collapsible: false };
}
sectionCounter = 0;

let blockCounter = 0;
function blockId(): string { blockCounter++; return `blk_${Date.now()}_${blockCounter}`; }

function findBlockInArray(arr: PlacedBlock[], blockId: string): PlacedBlock | null {
  const top = arr.find((b) => b.id === blockId);
  if (top) return top;
  for (const blk of arr) {
    if (blk.blockType === 'tab_group' && blk.tabs) {
      for (const tab of blk.tabs) {
        const found = tab.blocks.find((tb) => tb.id === blockId);
        if (found) return found;
      }
    }
  }
  return null;
}

function defaultPropsForBlock(blockType: BlockType, fieldId?: string): Partial<PlacedBlock> {
  if (blockType === 'field') return { fieldId, labelOverride: '', width: 6 };
  if (blockType === 'related_list') return {
    width: 12,
  };
  if (blockType === 'tab_group') return {
    tabs: [
      { id: 'tab1', label: 'Details', sectionIds: [], blocks: [] },
      { id: 'tab2', label: 'Activity', sectionIds: [], blocks: [] },
      { id: 'tab3', label: 'Files', sectionIds: [], blocks: [] },
    ],
    width: 12,
  };
  return {};
}

// ─── Mock related data ────────────────────────────────────────

function buildMockRecord(fields: SailsFieldDefinition[]): Record<string, any> {
  const record: Record<string, any> = {};
  fields.forEach((f) => {
    // Delegate mock value generation to the resolved control plugin so the
    // canvas preview looks exactly like the real front-end renderer.
    record[f.fieldName] = mockFieldValue(f);
  });
  return record;
}

/** Mock preview for a "Related List View" block, derived from the child model's fields. */
function buildRelatedPreview(blk: PlacedBlock, models: any[]): { title: string; cols: string[]; rows: Record<string, any>[]; configured: boolean } {
  const child = models.find((t: any) => t.tableName === blk.relatedTableName);
  const fields: SailsFieldDefinition[] = child?.fields || [];
  const title = blk.relatedTableLabel || blk.relatedTableName || 'Related Records';
  if (!blk.relatedTableName || !blk.relatedFieldName) {
    return { title, cols: [], rows: [], configured: false };
  }
  const cols = fields.filter((f: any) => f.fieldName !== 'id').slice(0, 4).map((f: any) => f.fieldName);
  const rows = fields.length > 0 ? [buildMockRecord(fields), buildMockRecord(fields)] : [];
  return { title, cols, rows, configured: true };
}

function renderFieldValue(
  field: SailsFieldDefinition,
  record: Record<string, any>,
  controlPluginId: string | undefined,
  mode: 'edit' | 'display',
  opts?: {
    inert?: boolean;
    onValueChange?: (val: any) => void;
    rules?: FieldValidation[];
    showErrors?: boolean;
  }
): React.ReactNode {
  const val = record[field.fieldName];

  // Read-Only View — mirrors the real page's DetailFieldDisplay
  // (DynamicDetailPage.tsx): formatted display rendering, no input chrome.
  if (mode === 'display') {
    return <DetailFieldDisplay field={field} val={val} controlPluginId={controlPluginId} />;
  }

  // Edit mode — mirrors the real page's DetailFieldInput exactly:
  // .ls-block__input-wrapper > control. Inert (pointer-events blocked) in
  // design mode; fully interactive in Preview mode where typing updates the
  // mock record so conditions evaluate live.
  return (
    <DetailFieldInput
      field={field}
      fieldKey={field.fieldName}
      label={field.name}
      val={val}
      controlPluginId={controlPluginId}
      inert={opts?.inert}
      rules={opts?.rules}
      showErrors={opts?.showErrors}
      record={record}
      onChange={(_key, v) => opts?.onValueChange && opts.onValueChange(v)}
    />
  );
}

function buildPalette(fields: SailsFieldDefinition[], placedFieldIds: string[]): PaletteItem[] {
  const items: PaletteItem[] = [];
  fields.forEach((f) => {
    if (!placedFieldIds.includes(f.id)) {
      items.push({ id: `pf_${f.id}`, blockType: 'field', fieldId: f.id, label: f.name, icon: null, description: f.logicalType });
    }
  });
  items.push({ id: 'rel_list_view', blockType: 'related_list', label: 'Related List View', icon: <ListTree size={13} />, description: 'Inline list of records linked via FK' });
  items.push({ id: 'layout_tabs', blockType: 'tab_group', label: 'Tab Group', icon: <FolderKanban size={13} />, description: 'Tabbed container' });
  return items;
}

function evaluateCondition(cond: BlockCondition, record: Record<string, any>, fields: SailsFieldDefinition[]): boolean {
  const field = fields.find((f) => f.id === cond.fieldId);
  if (!field) return true;
  const val = record[field.fieldName];
  const compare = cond.value;

  switch (cond.operator) {
    case 'empty': return val === undefined || val === null || String(val).trim() === '';
    case 'not_empty': return val !== undefined && val !== null && String(val).trim() !== '';
    case 'eq': return String(val) === compare;
    case 'neq': return String(val) !== compare;
    case 'contains': return String(val || '').toLowerCase().includes((compare || '').toLowerCase());
    case 'gt': return Number(val) > Number(compare);
    case 'gte': return Number(val) >= Number(compare);
    case 'lt': return Number(val) < Number(compare);
    case 'lte': return Number(val) <= Number(compare);
    default: return true;
  }
}

function evaluateConditions(conditions: BlockCondition[] | undefined, record: Record<string, any>, fields: SailsFieldDefinition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  let result = evaluateCondition(conditions[0], record, fields);
  for (let i = 1; i < conditions.length; i++) {
    const next = evaluateCondition(conditions[i], record, fields);
    result = conditions[i].logic === 'or' ? (result || next) : (result && next);
  }
  return result;
}

// ─── LIST View Helpers ─────────────────────────────────────

let listColCounter = 0;
function listColId(): string { listColCounter++; return `col_${Date.now()}_${listColCounter}`; }

function buildDefaultListColumns(fields: SailsFieldDefinition[]): LayoutColumn[] {
  listColCounter = 0;
  return fields.slice(0, 5).map((f, i) => ({
    id: listColId(), fieldId: f.id, position: i, visible: true,
    allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false,
  }));
}

function buildMockRows(fields: SailsFieldDefinition[]): Record<string, any>[] {
  const base = buildMockRecord(fields);
  return Array.from({ length: 5 }, (_, i) => {
    const rec: Record<string, any> = {};
    Object.keys(base).forEach((k) => { rec[k] = base[k]; });
    fields.forEach((f) => {
      const val = rec[f.fieldName];
      if (f.logicalType === 'currency') rec[f.fieldName] = Math.round((Number(val) || 1000) * (1 + i * 0.3));
      else if (f.logicalType === 'number') rec[f.fieldName] = (Number(val) || 10) + i * 10;
      else if (f.logicalType === 'select' && i > 0) {
        const opts = ((f.config as any)?.options || []) as { label: string; value: string }[];
        if (opts.length > 0) rec[f.fieldName] = opts[i % opts.length]?.value || val;
      }
    });
    return rec;
  });
}

const NUMERIC_COLUMN_TYPES = new Set(['number', 'decimal', 'currency', 'percentage', 'percent']);

// Synthesize a single value for a field that satisfies the given operator against the rule value.
function synthValueForRule(rule: FilterRule, field: SailsFieldDefinition, current: any): any {
  const lt = field.logicalType;
  const numeric = NUMERIC_COLUMN_TYPES.has(lt);
  const val = rule.value;
  switch (rule.operator) {
    case 'neq': {
      if (numeric) return (Number(val) || 0) + 1;
      if (typeof val === 'string' && val.trim() !== '') return `${val} 2`;
      return 'sample';
    }
    case 'contains': return val == null || String(val).trim() === '' ? current : `${String(val)} sample`;
    case 'is_empty': return lt === 'boolean' ? false : '';
    case 'is_not_empty': return lt === 'boolean' ? true : (current == null || current === '' ? 'sample' : current);
    case 'gt':
    case 'gte': {
      if (numeric) return (Number(val) || 0) + (rule.operator === 'gt' ? 1 : 0);
      if ((lt === 'date' || lt === 'datetime' || lt === 'timestamp') && typeof val === 'string' && val.length >= 10) {
        const d = new Date(`${val.slice(0, 10)}T00:00:00Z`);
        if (!isNaN(d.getTime())) { d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
      }
      return val ?? current;
    }
    case 'lt':
    case 'lte': {
      if (numeric) return (Number(val) || 0) - (rule.operator === 'lt' ? 1 : 0);
      if ((lt === 'date' || lt === 'datetime' || lt === 'timestamp') && typeof val === 'string' && val.length >= 10) {
        const d = new Date(`${val.slice(0, 10)}T00:00:00Z`);
        if (!isNaN(d.getTime())) { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
      }
      return val ?? current;
    }
    default: return val ?? current; // eq and others: match the criteria value exactly
  }
}

// Shape a mock row so the given filter rule passes against it.
function applyRuleToMockRow(rec: Record<string, any>, rule: FilterRule, fields: SailsFieldDefinition[]): void {
  const field = fields.find((fd) => fd.id === rule.fieldId || fd.fieldName === rule.fieldId);
  const source = rule.valueSource || 'value';
  if (source === 'record' || source === 'context') return; // resolve server-side; match-all in preview
  if (source === 'field' && rule.refFieldId) {
    const refField = fields.find((fd) => fd.id === rule.refFieldId || fd.fieldName === rule.refFieldId);
    if (!field || !refField) return;
    const refVal = rec[refField.fieldName];
    switch (rule.operator) {
      case 'eq':            rec[field.fieldName] = refVal; break;
      case 'neq':           rec[field.fieldName] = refVal == null || refVal === '' ? 'sample' : `${refVal} 2`; break;
      case 'contains':      rec[field.fieldName] = refVal == null || refVal === '' ? 'sample' : `${refVal} sample`; break;
      case 'gt':
      case 'gte':           rec[field.fieldName] = synthValueForRule({ ...rule, valueSource: 'value', operator: 'gt' }, field, refVal); break;
      case 'lt':
      case 'lte':           rec[field.fieldName] = synthValueForRule({ ...rule, valueSource: 'value', operator: 'lt' }, field, refVal); break;
      default:              rec[field.fieldName] = refVal;
    }
    return;
  }
  if (!field) return;
  const val = synthValueForRule(rule, field, rec[field.fieldName]);
  if (rule.operator === 'is_empty') rec[field.fieldName] = '';
  else rec[field.fieldName] = val;
}

// Produce fake rows that follow the filter criteria so the preview table is never empty.
function synthesizeFilteredRows(baseRows: Record<string, any>[], filters: FilterGroup[], fields: SailsFieldDefinition[]): Record<string, any>[] {
  const groups = filters.filter((g) => g.rules && g.rules.length > 0);
  if (groups.length === 0) return baseRows;
  const skeleton = baseRows.length > 0 ? baseRows : [{}];
  const cloneRow = (i: number): Record<string, any> => {
    const rec: Record<string, any> = {};
    Object.keys(skeleton[i % skeleton.length]).forEach((k) => { rec[k] = skeleton[i % skeleton.length][k]; });
    return rec;
  };
  const out: Record<string, any>[] = [];
  if (groups.every((g) => g.groupLogic === 'or')) {
    groups.forEach((grp) => {
      for (let i = 0; i < skeleton.length; i++) {
        const rec = cloneRow(i);
        grp.rules.forEach((r) => applyRuleToMockRow(rec, r, fields));
        out.push(rec);
      }
    });
  } else {
    for (let i = 0; i < skeleton.length; i++) {
      const rec = cloneRow(i);
      groups.forEach((grp) => grp.rules.forEach((r) => applyRuleToMockRow(rec, r, fields)));
      out.push(rec);
    }
  }
  return out;
}

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

let listSummCounter = 0;
function listSummId(): string { listSummCounter++; return `summ_${Date.now()}_${listSummCounter}`; }

const LIST_PER_PAGE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

function listOperatorLabel(op: string): string {
  const labels: Record<string, string> = {
    eq: '=', neq: '\u2260', gt: '>', gte: '\u2265', lt: '<', lte: '\u2264',
    contains: 'contains', is_empty: 'is empty', is_not_empty: 'is not empty',
  };
  return labels[op] || op;
}

const MAX_SORT_RULES = 3;

// ─── Undo / Redo history ─────────────────────────────────────

/** Deep-cloneable snapshot of one view's editor config. */
interface LsSnapshot {
  viewType: ViewType;
  config: any;
}

const HISTORY_MAX_ENTRIES = 50;
/** Rapid successive changes (typing, quick clicks) coalesce into one entry. */
const HISTORY_COALESCE_MS = 500;
const HISTORY_VIEWS: ViewType[] = ['LIST', 'DETAIL', 'FORM'];

// ─── Main Component ───────────────────────────────────────────

const LayoutStudio: React.FC = () => {
  const { tableId, layoutId } = useParams<{ tableId: string; layoutId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const datetimePrefs = useDateTimePrefs();

  const [tableMeta, setTableMeta] = useState<TableMeta | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [listViewsByTable, setListViewsByTable] = useState<Record<string, { id: string; name: string }[]>>({});

  const [sections, setSections] = useState<BuilderSection[]>([newSection()]);
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [layoutRecordTitleField, setLayoutRecordTitleField] = useState<string | null>(null);
  const [previewCollapsedMap, setPreviewCollapsedMap] = useState<Record<string, boolean>>({});
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, number>>({});
  const [dragOverTabBlockId, setDragOverTabBlockId] = useState<string | null>(null);
  const [dragOverChildBlockId, setDragOverChildBlockId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [propsFloating, setPropsFloating] = useState(false);
  const [propsWidth, setPropsWidth] = useState(260);
  const [propsResizing, setPropsResizing] = useState(false);
  const [paletteFloating, setPaletteFloating] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(220);
  const [paletteResizing, setPaletteResizing] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mockRecord, setMockRecord] = useState<Record<string, any>>({});
  const [resizing, setResizing] = useState<{ blockId: string; startX: number; startSpan: number; sectionElement: HTMLElement | null } | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('DETAIL');
  const [layoutStatus, setLayoutStatus] = useState<LayoutStatus>('draft');
  const [isEditing, setIsEditing] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [activatingLayout, setActivatingLayout] = useState(false);
  const [hasPublishedVersion, setHasPublishedVersion] = useState(false);
  const [activateNotes, setActivateNotes] = useState('');
  const [layoutVersions, setLayoutVersions] = useState<{ id: string; version: number; notes: string | null; publishedBy: string | null; publishedAt: string }[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackConfirmVersion, setRollbackConfirmVersion] = useState<number | null>(null);

  // ── LIST mode state ──
  const [listColumns, setListColumns] = useState<LayoutColumn[]>([]);
  const [availableDetailLayouts, setAvailableDetailLayouts] = useState<{ id: string; name: string; viewType: string }[]>([]);
  const [listFilters, setListFilters] = useState<FilterGroup[]>([]);
  const [listSortBy, setListSortBy] = useState<LayoutSort[]>([]);
  const [listSelectedColId, setListSelectedColId] = useState<string | null>(null);
  const [listSelectedFiltId, setListSelectedFiltId] = useState<string | null>(null);
  const [listDragOverColId, setListDragOverColId] = useState<string | null>(null);
  const [listMockRows, setListMockRows] = useState<Record<string, any>[]>([]);
  const [listColResizing, setListColResizing] = useState<{ columnId: string; startX: number; startWidth: number; widthUnit: string } | null>(null);

  // ── New LIST state (from TableBuilder mockup) ──
  const [listSummaryFields, setListSummaryFields] = useState<SummaryField[]>([]);
  const [listOverlayMode, setListOverlayMode] = useState<'edit-sort' | 'edit-filter' | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterGroup[] | null>(null);
  const [sortDraft, setSortDraft] = useState<LayoutSort[] | null>(null);
  const [sortNewFieldId, setSortNewFieldId] = useState<string>('');
  const [listRuntimeSortRules, setListRuntimeSortRules] = useState<LayoutSort[]>([]);
  const [listRuntimeFilters, setListRuntimeFilters] = useState<Record<string, string>>({});
  const [listActivePreviewFilter, setListActivePreviewFilter] = useState<string | null>(null);
  const [listAllowMultiSelect, setListAllowMultiSelect] = useState(false);
  const [listAllowInlineEdit, setListAllowInlineEdit] = useState(false);
  const [listAllowInlineCreate, setListAllowInlineCreate] = useState(false);
  const [listAllowInlineDelete, setListAllowInlineDelete] = useState(false);
  const [listAllowPaging, setListAllowPaging] = useState(false);
  const [listRecordsPerPage, setListRecordsPerPage] = useState(25);
  const [listPagingMode, setListPagingMode] = useState<'fixed' | 'dynamic'>('fixed');
  const [listSelectedIndices, setListSelectedIndices] = useState<Set<number>>(new Set());
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [layoutName, setLayoutName] = useState('');
  const [layoutDescription, setLayoutDescription] = useState('');
  const [layoutIsDefault, setLayoutIsDefault] = useState(false);
  const [layoutSystemName, setLayoutSystemName] = useState('');
  const [listSavingMeta, setListSavingMeta] = useState(false);
  const [showEditMetaOverlay, setShowEditMetaOverlay] = useState(false);
  const [showSetDefaultConfirm, setShowSetDefaultConfirm] = useState(false);
  const [setDefaultLoading, setSetDefaultLoading] = useState(false);
  const [showListDeleteConfirm, setShowListDeleteConfirm] = useState(false);
  const [listDeleteLoading, setListDeleteLoading] = useState(false);
  // ── Action Buttons state ──
  const [listActions, setListActions] = useState<ListAction[]>([]);
  const [listSelectedActionId, setListSelectedActionId] = useState<string | null>(null);
  const [listMobileViewMode, setListMobileViewMode] = useState<MobileViewMode>('table');

  // ── Undo / Redo history (per-view stacks) ──
  const [undoStack, setUndoStack] = useState<Record<string, LsSnapshot[]>>(
    Object.fromEntries(HISTORY_VIEWS.map((v) => [v, []])) as Record<string, LsSnapshot[]>
  );
  const [redoStack, setRedoStack] = useState<Record<string, LsSnapshot[]>>(
    Object.fromEntries(HISTORY_VIEWS.map((v) => [v, []])) as Record<string, LsSnapshot[]>
  );
  const baselineRef = useRef<Record<string, LsSnapshot | null>>({ LIST: null, DETAIL: null, FORM: null });
  const historyReadyRef = useRef(false);      // arming after the initial layout fetch
  const justLoadedRef = useRef(false);        // one-shot: sync baseline without recording
  const suppressHistoryRef = useRef(false);   // one-shot: undo/redo applies themselves
  const gestureActiveRef = useRef(false);     // sticky: live resize gestures (column / block width)
  const lastPushTimeRef = useRef(0);          // coalescing window anchor
  /** Per-column header refs, used to anchor the list preview filter popovers. */
  const filterThRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  useEffect(() => {
    if (!tableId) { setFetchError('No table ID provided'); setFetchLoading(false); return; }
    if (tableId === '_custom') {
      setTableMeta({ id: '_custom', name: 'Custom Layout', tableName: 'custom', fields: [] });
      setMockRecord({});
      setFetchLoading(false);
      return;
    }
    const fetchTable = async () => {
      try {
        const data = await fetchCached('/api/metadata/objects', undefined, 5000);
        const tables: any[] = Array.isArray(data) ? data : (data.data || []);
        const found = tables.find((t: any) => t.id === tableId);
        if (!found) throw new Error('Table not found');
        setModels(tables);
        setTableMeta({ id: found.id, name: found.name, tableName: found.tableName, fields: found.fields || [] });
        setMockRecord(buildMockRecord(found.fields || []));
        setListMockRows(buildMockRows(found.fields || []));

        try {
          const lData = await fetchCached(`/api/console/layouts?tableId=${tableId}`);
          const rows = lData.data?.rows || lData.rows || [];
          const details = rows.filter((r: any) => (r.viewType === 'DETAIL' || r.viewType === 'FORM') && r.status === 'active');
          setAvailableDetailLayouts(details.map((r: any) => ({ id: r.id, name: r.name || r.id, viewType: r.viewType })));
        } catch (e) {
          console.error('Failed to load sibling detail layouts', e);
        }
      } catch (err: any) {
        setFetchError(err.message || 'Failed to load table metadata');
      } finally {
        setFetchLoading(false);
      }
    };
    fetchTable();
  }, [tableId]);

  useEffect(() => {
    if (!layoutId || layoutId === '_new' || layoutId === 'new') return;
    const loadLayout = async () => {
      try {
        const json = await fetchCached(`/api/console/layouts?id=${layoutId}`);
        if (!json.success) throw new Error(json.error || 'Failed to load layout');
        const layout = json.data;
        const vType = (layout.viewType as ViewType) || 'DETAIL';
        setViewType(vType);
        setLayoutName(layout.name || '');
        setLayoutDescription(layout.description || '');
        setLayoutIsDefault(layout.isDefault || false);
        setLayoutSystemName(layout.systemName || '');
        setLayoutRecordTitleField(vType === 'LIST' ? null : (layout.recordTitleField || null));
        const status = layout.status || 'draft';
        setLayoutStatus(status);
        setHasPublishedVersion(!!layout.publishedConfig);
        if (layout.versions && Array.isArray(layout.versions)) setLayoutVersions(layout.versions);
        if (typeof layout.currentVersion === 'number') setCurrentVersion(layout.currentVersion);
        if (status === 'active') {
          setIsEditing(false);
        } else {
          setIsEditing(true);
        }
        const configSource = status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
        if (configSource) {
          const config = typeof configSource === 'string' ? JSON.parse(configSource) : configSource;
          if (vType === 'LIST') {
            if (config.columns && config.columns.length > 0) setListColumns(config.columns);
            if (config.filters) setListFilters(normalizeFilters(config.filters));
            if (config.sortBy) setListSortBy(config.sortBy);
            if (config.summaryFields) setListSummaryFields(config.summaryFields);
            if (config.actions && Array.isArray(config.actions)) setListActions(config.actions);
            if (typeof config.allowMultiSelect === 'boolean') setListAllowMultiSelect(config.allowMultiSelect);
            if (typeof config.allowPaging === 'boolean') setListAllowPaging(config.allowPaging);
            if (config.recordsPerPage) setListRecordsPerPage(config.recordsPerPage);
            if (config.pagingMode) setListPagingMode(config.pagingMode);
            if (typeof config.allowInlineEdit === 'boolean') setListAllowInlineEdit(config.allowInlineEdit);
            if (typeof config.allowInlineCreate === 'boolean') setListAllowInlineCreate(config.allowInlineCreate);
            if (typeof config.allowInlineDelete === 'boolean') setListAllowInlineDelete(config.allowInlineDelete);
            if (config.mobileViewMode) setListMobileViewMode(config.mobileViewMode);
          } else {
            if (config.sections) setSections(config.sections);
            if (config.blocks) setBlocks(config.blocks);
          }
        }
      } catch (err: any) {
        console.error('Failed to load layout config:', err);
      }
      // Arm undo/redo only after the config has been fanned out, so the
      // initial fetch never records a phantom "empty layout" entry.
      historyReadyRef.current = true;
      justLoadedRef.current = true;
    };
    loadLayout();
  }, [layoutId]);

  const allFields = tableMeta?.fields ?? [];
  const currentTableName = tableMeta?.tableName || '';

  // Models that reference the current model via a relation/lookup FK field.
  const inboundModels = useMemo(() => {
    if (!currentTableName) return [];
    return models.filter((t: any) =>
      t.tableName !== currentTableName &&
      Array.isArray(t.fields) &&
      t.fields.some((f: any) =>
        (f.logicalType === 'relation' || f.logicalType === 'lookup') &&
        f.config?.targetTable === currentTableName
      )
    );
  }, [models, currentTableName]);

  // LIST views of a child model (cached per table).
  const loadListViewOptions = useCallback(async (tableName: string) => {
    if (!tableName || listViewsByTable[tableName]) return;
    try {
      const lData = await fetchCached(`/api/console/layouts?tableId=${encodeURIComponent(tableName)}&viewType=LIST&limit=100`);
      const rows: any[] = lData.data?.rows || lData.rows || [];
      setListViewsByTable((prev) => ({
        ...prev,
        [tableName]: rows.filter((r: any) => r.viewType === 'LIST').map((r: any) => ({ id: r.id, name: r.name || r.systemName || r.id })),
      }));
    } catch (e) {
      console.error('Failed to load list views for', tableName, e);
    }
  }, [listViewsByTable]);


  const isReadOnly = layoutStatus === 'active' && !isEditing;  // Auto-initialize LIST columns when fields load for a new/empty LIST layout
  useEffect(() => {
    if (viewType === 'LIST' && allFields.length > 0 && listColumns.length === 0) {
      setListColumns(buildDefaultListColumns(allFields));
    }
  }, [viewType, allFields, listColumns.length]);

  const placedFieldIds = blocks.filter((b) => b.blockType === 'field').map((b) => b.fieldId!).filter(Boolean);
  const palette = useMemo(() => buildPalette(allFields, placedFieldIds), [allFields, placedFieldIds]);
  const selectedBlock = useMemo(
    () => (selectedBlockId ? findBlockInArray(blocks, selectedBlockId) : null),
    [blocks, selectedBlockId],
  );
  const findBlockById = (blockId: string) => findBlockInArray(blocks, blockId);
  const selectedField = selectedBlock?.fieldId ? allFields.find((f) => f.id === selectedBlock.fieldId) : null;

  const selectedRelatedModel = inboundModels.find((t: any) => t.tableName === selectedBlock?.relatedTableName);
  const relatedFkFields = (selectedRelatedModel?.fields || []).filter((f: any) =>
    (f.logicalType === 'relation' || f.logicalType === 'lookup') &&
    f.config?.targetTable === currentTableName
  );

  useEffect(() => {
    if (selectedBlock?.relatedTableName) loadListViewOptions(selectedBlock.relatedTableName);
  }, [selectedBlock?.relatedTableName, loadListViewOptions]);
  const selectedSection = useMemo(
    () => (selectedSectionId ? sections.find((s) => s.id === selectedSectionId) || null : null),
    [sections, selectedSectionId],
  );

  useEffect(() => {
    if (selectedBlockId && !findBlockInArray(blocks, selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [blocks, selectedBlockId]);

  useEffect(() => {
    if (selectedSectionId && !sections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId(null);
    }
  }, [sections, selectedSectionId]);

  const blocksBySection = useMemo(() => {
    const map: Record<string, PlacedBlock[]> = {};
    sections.forEach((s) => { map[s.id] = []; });
    blocks.forEach((b) => {
      if (!map[b.sectionId]) map[b.sectionId] = [];
      map[b.sectionId].push(b);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.position - b.position);
    });
    return map;
  }, [sections, blocks]);

  // ── LIST computed values ──
  const sortedListColumns = useMemo(
    () => [...listColumns].sort((a, b) => a.position - b.position),
    [listColumns]
  );
  const visibleListColumns = useMemo(
    () => sortedListColumns.filter((c) => c.visible),
    [sortedListColumns]
  );
  const listColumnFieldIds = useMemo(
    () => listColumns.map((c) => c.fieldId),
    [listColumns]
  );
  const listSelectedCol = useMemo(
    () => listColumns.find((c) => c.id === listSelectedColId) ?? null,
    [listColumns, listSelectedColId]
  );
  const listSelectedFilter = useMemo(
    () => listFilters.find((f) => f.id === listSelectedFiltId) ?? null,
    [listFilters, listSelectedFiltId]
  );

  // Runtime preview computed values — the fake rows are shaped to follow the filter
  // criteria (client-side simulation over mock data only; never touches the real API/DB)
  const listFilteredRecords = useMemo(() => {
    return synthesizeFilteredRows(listMockRows, listFilters, allFields);
  }, [listMockRows, listFilters, allFields]);

  const listSortedRecords = useMemo(() => {
    if (listSortBy.length === 0) return listFilteredRecords;
    return [...listFilteredRecords].sort((a, b) => {
      for (const rule of listSortBy) {
        const sf = allFields.find((f) => f.id === rule.fieldId);
        if (!sf) continue;
        const av = a[sf.fieldName]; const bv = b[sf.fieldName];
        if (av == null && bv == null) continue;
        if (av == null) return 1; if (bv == null) return -1;
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [listFilteredRecords, listSortBy, allFields]);

  const listRuntimeRecords = useMemo(() => {
    let records = listFilteredRecords;
    Object.entries(listRuntimeFilters).forEach(([fieldId, filterText]) => {
      if (!filterText.trim()) return;
      const field = allFields.find((f) => f.id === fieldId);
      if (!field) return;
      const lower = filterText.toLowerCase();
      records = records.filter((rec) => String(rec[field.fieldName] ?? '').toLowerCase().includes(lower));
    });
    if (listRuntimeSortRules.length > 0) {
      records = [...records].sort((a, b) => {
        for (const rule of listRuntimeSortRules) {
          const sf = allFields.find((f) => f.id === rule.fieldId);
          if (!sf) continue;
          const av = a[sf.fieldName]; const bv = b[sf.fieldName];
          if (av == null && bv == null) continue;
          if (av == null) return 1; if (bv == null) return -1;
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    } else {
      records = listSortedRecords;
    }
    return records;
  }, [listFilteredRecords, listSortedRecords, listRuntimeSortRules, listRuntimeFilters, allFields]);

  const listTotalPages = useMemo(() => {
    if (!listAllowPaging) return 1;
    return Math.max(1, Math.ceil(listRuntimeRecords.length / listRecordsPerPage));
  }, [listAllowPaging, listRuntimeRecords.length, listRecordsPerPage]);

  const listSafeCurrentPage = useMemo(() => {
    return Math.max(1, Math.min(listCurrentPage, listTotalPages));
  }, [listCurrentPage, listTotalPages]);

  const listCurrentPageRecords = useMemo(() => {
    if (!listAllowPaging) return listRuntimeRecords;
    const start = (listSafeCurrentPage - 1) * listRecordsPerPage;
    return listRuntimeRecords.slice(start, start + listRecordsPerPage);
  }, [listAllowPaging, listRuntimeRecords, listSafeCurrentPage, listRecordsPerPage]);

  const listAllSelectedOnPage = useMemo(() => {
    if (listCurrentPageRecords.length === 0) return false;
    return listCurrentPageRecords.every((_, i) => listSelectedIndices.has(i));
  }, [listCurrentPageRecords, listSelectedIndices]);

  const listPageNumbers = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= listTotalPages; p++) {
      if (p === 1 || p === listTotalPages || Math.abs(p - listSafeCurrentPage) <= 1) {
        if (items.length > 0 && p - (items[items.length - 1] as number) > 1) items.push('ellipsis');
        items.push(p);
      }
    }
    return items;
  }, [listTotalPages, listSafeCurrentPage]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      if (!resizing) return;
      const grid = resizing.sectionElement;
      if (!grid) return;
      const colWidth = grid.offsetWidth / 12;
      const delta = e.clientX - resizing.startX;
      const colDelta = Math.round(delta / colWidth);
      const newSpan = Math.max(1, Math.min(12, resizing.startSpan + colDelta));
      updateBlock(resizing.blockId, { width: newSpan });
    };
    const onUp = () => {
      setResizing(null);
      gestureActiveRef.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!propsResizing) return;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, window.innerWidth - e.clientX));
      setPropsWidth(newWidth);
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
      const newWidth = Math.max(160, Math.min(400, e.clientX + 4));
      setPaletteWidth(newWidth);
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
    if (!listColResizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - listColResizing.startX;
      const newWidthPx = Math.max(30, listColResizing.startWidth + delta);
      const unit = listColResizing.widthUnit || '%';
      setListColumns((c) =>
        c.map((col) => {
          if (col.id !== listColResizing.columnId) return col;
          if (unit === '%' || !col.widthUnit) {
            const table = (document.querySelector('.ls-preview-table') || document.querySelector('.ls-runtime-table')) as HTMLElement;
            const tableWidth = table?.offsetWidth || 800;
            const pct = Math.round((newWidthPx / tableWidth) * 100);
            return { ...col, width: Math.max(3, Math.min(90, pct)), widthUnit: '%' } as LayoutColumn;
          }
          return { ...col, width: newWidthPx, widthUnit: 'px' } as LayoutColumn;
        })
      );
    };
    const onUp = () => {
      setListColResizing(null);
      gestureActiveRef.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [listColResizing]);

  const doReset = () => {
    if (viewType === 'LIST') {
      const f = allFields;
      setListColumns(f.length > 0 ? buildDefaultListColumns(f) : []);
      setListFilters([]);
      setListSortBy([]);
      setListSummaryFields([]);
      setListActions([]);
      setListSelectedActionId(null);
      setListSelectedColId(null);
      setListSelectedFiltId(null);
      setListDragOverColId(null);
      setListColResizing(null);
      setListOverlayMode(null);
      setListSelectedFiltId(null);
      setFilterDraft(null);
      setSortDraft(null);
      setSortNewFieldId('');
      setListRuntimeSortRules([]);
      setListRuntimeFilters({});
      setListActivePreviewFilter(null);
      setListAllowMultiSelect(false);
      setListAllowPaging(false);
      setListRecordsPerPage(25);
      setListPagingMode('fixed');
      setListAllowInlineEdit(false);
      setListAllowInlineCreate(false);
      setListAllowInlineDelete(false);
      setListSelectedIndices(new Set());
      setListCurrentPage(1);
      setListMobileViewMode('table');
    } else {
      setSections([newSection()]);
      setBlocks([]);
      setSelectedBlockId(null);
      setSelectedSectionId(null);
      setLayoutRecordTitleField(null);
      setActiveTabMap({});
      setDragOverTabBlockId(null);
      setDragOverChildBlockId(null);
      sectionCounter = 0;
      blockCounter = 0;
    }
    setShowResetConfirm(false);
    setPropsFloating(false);
    setPaletteFloating(false);
  };

  const serializeLayout = () => {
    if (viewType === 'LIST') {
      return {
        columns: listColumns,
        filters: listFilters,
        sortBy: listSortBy,
        summaryFields: listSummaryFields,
        actions: listActions,
        allowMultiSelect: listAllowMultiSelect,
        allowPaging: listAllowPaging,
        recordsPerPage: listRecordsPerPage,
        pagingMode: listPagingMode,
        allowInlineEdit: listAllowInlineEdit,
        allowInlineCreate: listAllowInlineCreate,
        allowInlineDelete: listAllowInlineDelete,
        mobileViewMode: listMobileViewMode,
      };
    }
    return { sections, blocks };
  };

  // ── Undo / Redo engine ──

  const makeSnapshot = (): LsSnapshot => ({
    viewType,
    config: JSON.parse(JSON.stringify(serializeLayout())),
  });

  /** Restore a snapshot's config into the editor state (mirrors the load effect fan-out). */
  const applySnapshot = (snap: LsSnapshot) => {
    const c = snap.config || {};
    if (snap.viewType === 'LIST') {
      setListColumns(Array.isArray(c.columns) ? c.columns : []);
      setListFilters(normalizeFilters(Array.isArray(c.filters) ? c.filters : []));
      setListSortBy(Array.isArray(c.sortBy) ? c.sortBy : []);
      setListSummaryFields(Array.isArray(c.summaryFields) ? c.summaryFields : []);
      setListActions(Array.isArray(c.actions) ? c.actions : []);
      setListAllowMultiSelect(!!c.allowMultiSelect);
      setListAllowPaging(!!c.allowPaging);
      setListRecordsPerPage(typeof c.recordsPerPage === 'number' ? c.recordsPerPage : 25);
      setListPagingMode((c.pagingMode as 'fixed' | 'dynamic') || 'fixed');
      setListAllowInlineEdit(!!c.allowInlineEdit);
      setListAllowInlineCreate(!!c.allowInlineCreate);
      setListAllowInlineDelete(!!c.allowInlineDelete);
      setListMobileViewMode((c.mobileViewMode as MobileViewMode) || 'table');
      setListSelectedColId(null);
      setListSelectedFiltId(null);
      setListSelectedActionId(null);
    } else {
      setSections(Array.isArray(c.sections) && c.sections.length > 0 ? c.sections : [newSection()]);
      setBlocks(Array.isArray(c.blocks) ? c.blocks : []);
      setSelectedBlockId(null);
      setSelectedSectionId(null);
    }
  };

  /** Record the current state as a discrete gesture (one undo step for the whole drag). */
  const pushGestureSnapshot = () => {
    const v = viewType;
    const snap = makeSnapshot();
    setUndoStack((s) => ({ ...s, [v]: [...s[v], snap].slice(-HISTORY_MAX_ENTRIES) }));
    setRedoStack((s) => ({ ...s, [v]: [] }));
    gestureActiveRef.current = true;
  };

  // Watch effect: runs after every render, cheap JSON diff against the
  // per-view baseline. Pushes a history entry only when the current view's
  // config actually changed. One-shot flags prevent the load / undo / redo
  // applications themselves from being recorded.
  useEffect(() => {
    const snap = makeSnapshot();
    const v = snap.viewType;
    if (!historyReadyRef.current || justLoadedRef.current || suppressHistoryRef.current || gestureActiveRef.current) {
      if (justLoadedRef.current) justLoadedRef.current = false;
      if (suppressHistoryRef.current) suppressHistoryRef.current = false;
      baselineRef.current[v] = snap;
      return;
    }
    const prev = baselineRef.current[v];
    if (prev && JSON.stringify(prev.config) !== JSON.stringify(snap.config)) {
      const now = Date.now();
      const coalescing = now - lastPushTimeRef.current < HISTORY_COALESCE_MS;
      setUndoStack((s) => {
        const stack = s[v] || [];
        const next = coalescing && stack.length > 0
          ? [...stack.slice(0, -1), prev]
          : [...stack, prev];
        lastPushTimeRef.current = now;
        return { ...s, [v]: next.slice(-HISTORY_MAX_ENTRIES) };
      });
      setRedoStack((s) => ({ ...s, [v]: [] }));
    }
    baselineRef.current[v] = snap;
  });

  const handleUndo = () => {
    const v = viewType;
    const past = undoStack[v] || [];
    if (past.length === 0 || !isEditing || previewMode) return;
    const prev = past[past.length - 1];
    setUndoStack((s) => ({ ...s, [v]: s[v].slice(0, -1) }));
    setRedoStack((s) => ({ ...s, [v]: [...s[v], makeSnapshot()] }));
    suppressHistoryRef.current = true;
    applySnapshot(prev);
  };

  const handleRedo = () => {
    const v = viewType;
    const future = redoStack[v] || [];
    if (future.length === 0 || !isEditing || previewMode) return;
    const next = future[future.length - 1];
    setRedoStack((s) => ({ ...s, [v]: s[v].slice(0, -1) }));
    setUndoStack((s) => ({ ...s, [v]: [...s[v], makeSnapshot()] }));
    suppressHistoryRef.current = true;
    applySnapshot(next);
  };

  const canUndo = (undoStack[viewType] || []).length > 0;
  const canRedo = (redoStack[viewType] || []).length > 0;

  // ── Action Registry Helpers ──
  const availableListActionPlugins = useMemo(() => actionRegistry.getActionsByCategory('list'), []);

  const isActionEnabled = (actionKey: string) => {
    return listActions.some((a) => a.actionKey === actionKey && a.visible);
  };

  const toggleListAction = (actionKey: string) => {
    const plugin = actionRegistry.getAction(actionKey);
    if (!plugin) return;
    setListActions((prev) => {
      const existing = prev.find((a) => a.actionKey === actionKey);
      if (existing) {
        if (listSelectedActionId === existing.id) setListSelectedActionId(null);
        return prev.filter((a) => a.actionKey !== actionKey);
      }
      const newAction: ListAction = {
        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        actionKey: actionKey as ListAction['actionKey'],
        label: plugin.defaultLabel,
        variant: plugin.defaultVariant,
        visible: true,
      };
      return [...prev, newAction];
    });
  };

  const updateListAction = (id: string, patch: Partial<ListAction>) => {
    setListActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  // ── Global Canvas Keyboard Shortcuts (Escape / Delete) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (e.key === 'Escape') {
        setListSelectedColId(null);
        setListSelectedActionId(null);
        return;
      }

      // Undo / Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y.
      // Skipped while typing so the browser handles native text undo.
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !isInput && isEditing && !previewMode) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (k === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (listSelectedActionId) {
          const act = listActions.find((a) => a.id === listSelectedActionId);
          if (act) {
            toggleListAction(act.actionKey);
            setListSelectedActionId(null);
          }
        } else if (listSelectedColId) {
          removeListColumn(listSelectedColId);
          setListSelectedColId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listSelectedActionId, listSelectedColId, listActions, undoStack, redoStack, viewType, isEditing, previewMode]);

  const handleSaveClick = () => {
    setSaveError(null);
    setShowSaveConfirm(true);
  };

  const doSave = async () => {
    if (!layoutId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const config = serializeLayout();
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layoutId, config, recordTitleField: layoutRecordTitleField || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save layout');
      setShowSaveConfirm(false);
      setSavedSuccessMsg('Layout saved successfully.');
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = async () => {
    if (!layoutId) return;
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layoutId, action: 'start-edit' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to start editing');
      setLayoutStatus('draft');
      setIsEditing(true);
      setHasPublishedVersion(true);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to start editing');
    }
  };

  const handleActivateClick = () => {
    setShowActivateConfirm(true);
  };

  const doActivate = async () => {
    if (!layoutId) return;
    setActivatingLayout(true);
    setShowActivateConfirm(false);
    try {
      const config = serializeLayout();
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: layoutId,
          config,
          recordTitleField: layoutRecordTitleField || null,
          action: 'activate',
          notes: activateNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to activate layout');
      setLayoutStatus('active');
      setIsEditing(false);
      setHasPublishedVersion(true);
      setActivateNotes('');
      const fresh = await fetchCached(`/api/console/layouts?id=${layoutId}`);
      if (fresh.success) {
        if (Array.isArray(fresh.data.versions)) setLayoutVersions(fresh.data.versions);
        if (typeof fresh.data.currentVersion === 'number') setCurrentVersion(fresh.data.currentVersion);
      }
      setSavedSuccessMsg(`Layout activated — version ${currentVersion} published.`);
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to activate layout');
    } finally {
      setActivatingLayout(false);
    }
  };

  const doRollback = async (targetVersion: number) => {
    if (!layoutId) return;
    setRollbackLoading(true);
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layoutId, action: 'rollback', targetVersion }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to rollback layout');
      // Reload the whole layout so the editor reflects the rolled-back config.
      const fresh = await fetchCached(`/api/console/layouts?id=${layoutId}`);
      if (fresh.success) {
        const layout = fresh.data;
        setLayoutStatus('draft');
        setIsEditing(true);
        const vType = (layout.viewType as ViewType) || 'DETAIL';
        setViewType(vType);
        if (Array.isArray(layout.versions)) setLayoutVersions(layout.versions);
        if (typeof layout.currentVersion === 'number') setCurrentVersion(layout.currentVersion);
        const configSource = layout.config;
        if (configSource) {
          const config = typeof configSource === 'string' ? JSON.parse(configSource) : configSource;
          if (vType === 'LIST') {
            if (config.columns) setListColumns(config.columns);
            if (config.filters) setListFilters(normalizeFilters(config.filters));
            if (config.sortBy) setListSortBy(config.sortBy);
            if (config.summaryFields) setListSummaryFields(config.summaryFields);
            if (config.actions && Array.isArray(config.actions)) setListActions(config.actions);
            if (typeof config.allowMultiSelect === 'boolean') setListAllowMultiSelect(config.allowMultiSelect);
            if (typeof config.allowPaging === 'boolean') setListAllowPaging(config.allowPaging);
            if (config.recordsPerPage) setListRecordsPerPage(config.recordsPerPage);
            if (config.pagingMode) setListPagingMode(config.pagingMode);
            if (typeof config.allowInlineEdit === 'boolean') setListAllowInlineEdit(config.allowInlineEdit);
            if (typeof config.allowInlineCreate === 'boolean') setListAllowInlineCreate(config.allowInlineCreate);
            if (typeof config.allowInlineDelete === 'boolean') setListAllowInlineDelete(config.allowInlineDelete);
          } else {
            if (config.sections) setSections(config.sections);
            if (config.blocks) setBlocks(config.blocks);
          }
        }
      }
      setSavedSuccessMsg(`Rolled back to version ${targetVersion}. Activate to publish it.`);
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to rollback layout');
    } finally {
      setRollbackLoading(false);
    }
  };

  const doDiscard = async () => {
    if (!layoutId) return;
    setShowDiscardConfirm(false);
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: layoutId, action: 'discard-draft' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to discard changes');
      setLayoutStatus('active');
      setIsEditing(false);
      const configSource = json.data.config;
      if (configSource) {
        const config = typeof configSource === 'string' ? JSON.parse(configSource) : configSource;
        if (viewType === 'LIST') {
          if (config.columns && config.columns.length > 0) setListColumns(config.columns);
          else setListColumns([]);
          if (config.filters) setListFilters(normalizeFilters(config.filters));
          else setListFilters([]);
          if (config.sortBy) setListSortBy(config.sortBy);
          else setListSortBy([]);
          if (config.summaryFields) setListSummaryFields(config.summaryFields);
          else setListSummaryFields([]);
          setListMobileViewMode((config.mobileViewMode as MobileViewMode) || 'table');
          if (config.actions) setListActions(config.actions);
          else setListActions([]);
          if (typeof config.allowMultiSelect === 'boolean') setListAllowMultiSelect(config.allowMultiSelect);
          if (typeof config.allowPaging === 'boolean') setListAllowPaging(config.allowPaging);
          if (config.recordsPerPage) setListRecordsPerPage(config.recordsPerPage);
          if (config.pagingMode) setListPagingMode(config.pagingMode);
          if (typeof config.allowInlineEdit === 'boolean') setListAllowInlineEdit(config.allowInlineEdit);
          if (typeof config.allowInlineCreate === 'boolean') setListAllowInlineCreate(config.allowInlineCreate);
          if (typeof config.allowInlineDelete === 'boolean') setListAllowInlineDelete(config.allowInlineDelete);
        } else {
          if (config.sections) setSections(config.sections);
          else setSections([]);
          if (config.blocks) setBlocks(config.blocks);
          else setBlocks([]);
        }
      }
      setSavedSuccessMsg('Changes discarded. Layout reverted to active version.');
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to discard changes');
    }
  };

  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN'];
  if (!allowedRoles.includes(user?.role || '')) {
    return <Unauthorized />;
  }

  if (fetchLoading) {
    return (
      <div className="ls-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <Loader2 size={24} style={{ animation: 'sails-spin 1s linear infinite' }} />
        <span style={{ color: 'var(--sails-text-muted)' }}>Loading model fields...</span>
      </div>
    );
  }

  if (fetchError || !tableMeta) {
    return (
      <div className="ls-root" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <AlertCircle size={32} style={{ color: 'var(--sails-danger)' }} />
        <span style={{ color: 'var(--sails-text-main)' }}>{fetchError || 'Table not found'}</span>
        <button className="sails-btn sails-btn--ghost" onClick={() => navigate('/admin/views')}><ArrowLeft size={14} /> Go back</button>
      </div>
    );
  }

  // ── Actions ─────────────────────────────────────────────────

  const addSection = () => {
    setSections((s) => [...s, newSection()]);
    setSelectedBlockId(null);
    setSelectedSectionId(null);
  };

  const removeSection = (sectionId: string) => {
    setBlocks((b) => b.filter((blk) => blk.sectionId !== sectionId));
    setSections((s) => s.filter((sec) => sec.id !== sectionId));
    if (selectedBlock?.sectionId === sectionId) setSelectedBlockId(null);
    if (selectedSectionId === sectionId) setSelectedSectionId(null);
  };

  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) => {
    setSections((s) => s.map((sec) => (sec.id === sectionId ? { ...sec, ...patch } : sec)));
  };

  const addBlock = (item: PaletteItem, sectionId: string, insertBeforeId?: string) => {
    const newId = blockId();
    setBlocks((prev) => {
      const sectionBlocks = prev
        .filter((b) => b.sectionId === sectionId)
        .sort((a, b) => a.position - b.position);
      let targetIdx = sectionBlocks.length;
      if (insertBeforeId) {
        const found = sectionBlocks.findIndex((b) => b.id === insertBeforeId);
        if (found !== -1) targetIdx = found;
      }
      const blk: PlacedBlock = {
        id: newId,
        blockType: item.blockType,
        sectionId,
        position: targetIdx,
        width: 6,
        visible: true,
        ...defaultPropsForBlock(item.blockType, item.fieldId),
      };
      const shifted = prev.map((b) =>
        b.sectionId === sectionId && b.position >= targetIdx ? { ...b, position: b.position + 1 } : b
      );
      return [...shifted, blk];
    });
    setSelectedBlockId(newId);
    setSelectedSectionId(null);
  };

  const handleCanvasDeselect = () => {
    setListSelectedColId(null);
    setListSelectedActionId(null);
    setSelectedBlockId(null);
    setSelectedSectionId(null);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => {
      const topFiltered = prev.filter((blk) => blk.id !== blockId);
      if (topFiltered.length < prev.length) return topFiltered;
      return prev.map((blk) => {
        if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => ({
            ...tab,
            blocks: tab.blocks.filter((tb) => tb.id !== blockId),
          })),
        };
      });
    });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const addBlockToTab = (tabGroupBlockId: string, tabId: string, item: PaletteItem, insertBeforeId?: string) => {
    setBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const list = [...tab.blocks];
            let targetIdx = list.length;
            if (insertBeforeId) {
              const found = list.findIndex((b) => b.id === insertBeforeId);
              if (found !== -1) targetIdx = found;
            }
            const newBlock: PlacedBlock = {
              id: blockId(),
              blockType: item.blockType,
              sectionId: '',
              position: targetIdx,
              width: 6,
              visible: true,
              ...defaultPropsForBlock(item.blockType, item.fieldId),
            };
            const reindexed = list.map((b, i) => ({ ...b, position: i >= targetIdx ? i + 1 : i }));
            return { ...tab, blocks: [...reindexed, newBlock] };
          }),
        };
      })
    );
  };

  const moveBlockInTab = (tabGroupBlockId: string, tabId: string, blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const list = [...tab.blocks];
            const idx = list.findIndex((b) => b.id === blockId);
            if (idx === -1) return tab;
            const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (otherIdx < 0 || otherIdx >= list.length) return tab;
            const updated = list.map((b, i) => {
              if (i === idx) return { ...b, position: otherIdx };
              if (i === otherIdx) return { ...b, position: idx };
              return b;
            });
            return { ...tab, blocks: updated };
          }),
        };
      })
    );
  };

  const moveBlockToTab = (blockId: string, tabGroupBlockId: string, tabId: string) => {
    setBlocks((prev) => {
      const sourceBlock = findBlockInArray(prev, blockId);
      if (!sourceBlock) return prev;

      const removed = prev
        .filter((blk) => blk.id !== blockId)
        .map((blk) => {
          if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
          return {
            ...blk,
            tabs: blk.tabs.map((tab) => ({
              ...tab,
              blocks: tab.blocks.filter((tb) => tb.id !== blockId),
            })),
          };
        });

      return removed.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const placed: PlacedBlock = { ...sourceBlock, sectionId: '', position: tab.blocks.length };
            return { ...tab, blocks: [...tab.blocks, placed] };
          }),
        };
      });
    });
  };

  const moveBlockToSection = (blockId: string, targetSectionId: string) => {
    setBlocks((prev) => {
      const sourceBlock = findBlockInArray(prev, blockId);
      if (!sourceBlock) return prev;

      const existing = prev.filter((b) => b.sectionId === targetSectionId);
      const placed: PlacedBlock = { ...sourceBlock, sectionId: targetSectionId, position: existing.length };

      const mid = prev
        .filter((blk) => blk.id !== blockId)
        .map((blk) => {
          if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
          return {
            ...blk,
            tabs: blk.tabs.map((tab) => ({
              ...tab,
              blocks: tab.blocks.filter((tb) => tb.id !== blockId),
            })),
          };
        });

      return [...mid, placed];
    });
  };

  const moveBlockPosition = (blockId: string, sectionId: string, direction: 'up' | 'down') => {
    const list = [...(blocksBySection[sectionId] || [])];
    const idx = list.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= list.length) return;
    const updated = blocks.map((blk) => {
      if (blk.id === list[idx].id) return { ...blk, position: otherIdx };
      if (blk.id === list[otherIdx].id) return { ...blk, position: idx };
      return blk;
    });
    setBlocks(updated);
  };

  const updateBlock = (blockId: string, patch: Partial<PlacedBlock>) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        return prev.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      }
      return prev.map((blk) => {
        if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => ({
            ...tab,
            blocks: tab.blocks.map((tb) => (tb.id === blockId ? { ...tb, ...patch } : tb)),
          })),
        };
      });
    });
  };

  // Live-editable mock record — Preview mode writes back here so
  // conditions evaluate against current input (true WYSIWYG).
  const handleMockValueChange = (fieldName: string, value: any) => {
    setMockRecord((prev) => ({ ...prev, [fieldName]: value }));
  };

  // ── LIST View Actions ─────────────────────────────────────

  const addListColumn = (fieldId: string) => {
    const col: LayoutColumn = { id: listColId(), fieldId, position: listColumns.length, visible: true, allowSorting: false, allowFiltering: false, alignment: 'left', wrapText: false };
    setListColumns((c) => [...c, col]);
    setListSelectedColId(col.id);
    setListSelectedActionId(null);
    setListSelectedFiltId(null);
  };

  const removeListColumn = (columnId: string) => {
    setListColumns((c) => {
      const filtered = c.filter((col) => col.id !== columnId);
      return filtered.map((col, i) => ({ ...col, position: i } as LayoutColumn));
    });
    if (listSelectedColId === columnId) setListSelectedColId(null);
  };

  const toggleListColumnVisible = (columnId: string) => {
    setListColumns((c) => c.map((col) => col.id === columnId ? { ...col, visible: !col.visible } as LayoutColumn : col));
  };

  const moveListColumn = (columnId: string, direction: 'up' | 'down') => {
    setListColumns((c) => {
      const sorted = [...c].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((col) => col.id === columnId);
      if (idx === -1) return c;
      const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (otherIdx < 0 || otherIdx >= sorted.length) return c;
      return c.map((col) => {
        if (col.id === sorted[idx].id) return { ...col, position: otherIdx } as LayoutColumn;
        if (col.id === sorted[otherIdx].id) return { ...col, position: idx } as LayoutColumn;
        return col;
      });
    });
  };

  const updateListColumn = (columnId: string, patch: Partial<LayoutColumn>) => {
    setListColumns((c) =>
      c.map((col) => {
        if (col.id === columnId) {
          return { ...col, ...patch } as LayoutColumn;
        }
        if (patch.isPrimaryLink) {
          return { ...col, isPrimaryLink: false } as LayoutColumn;
        }
        return col;
      })
    );
  };

  const handleListColumnDrop = (sourceId: string, targetId: string) => {
    const sorted = [...listColumns].sort((a, b) => a.position - b.position);
    const srcIdx = sorted.findIndex((c) => c.id === sourceId);
    const tgtIdx = sorted.findIndex((c) => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    setListColumns(reordered.map((c, i) => ({ ...c, position: i } as LayoutColumn)));
  };

  const addListFilter = () => {
    setFilterDraft([...listFilters]);
    setListSelectedColId(null);
    setListOverlayMode('edit-filter');
  };

  const removeListFilterRule = (groupId: string, ruleId: string) => {
    setListFilters((groups) =>
      groups
        .map((g) => (g.id === groupId ? { ...g, rules: g.rules.filter((r) => r.id !== ruleId) } : g))
        .filter((g) => g.rules.length > 0)
    );
    setListSelectedFiltId(null);
  };

  const removeListFilterGroup = (groupId: string) => {
    setListFilters((groups) => groups.filter((g) => g.id !== groupId));
    setListSelectedFiltId(null);
  };

  const removeListSortRule = (index: number) => {
    setListSortBy((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Summary Actions ──
  const addListSummaryField = (fieldId: string) => {
    if (listSummaryFields.some((sf) => sf.fieldId === fieldId)) return;
    setListSummaryFields((prev) => [...prev, { id: listSummId(), fieldId }]);
  };

  const removeListSummaryField = (fieldId: string) => {
    setListSummaryFields((prev) => prev.filter((sf) => sf.fieldId !== fieldId));
  };

  // ── Overlay Actions ──
  const openListFilterEditor = (filterId?: string) => {
    setFilterDraft([...listFilters]);
    if (filterId) setListSelectedFiltId(filterId);
    setListOverlayMode('edit-filter');
  };

  const cancelListFilterEditor = () => {
    setFilterDraft(null);
    setListSelectedFiltId(null);
    setListOverlayMode(null);
  };

  const doneListFilterEditor = (groups: FilterGroup[]) => {
    setListFilters(groups);
    setFilterDraft(null);
    setListSelectedFiltId(null);
    setListOverlayMode(null);
  };

  const openListSortEditor = () => {
    setSortDraft([...listSortBy]);
    setSortNewFieldId('');
    setListOverlayMode('edit-sort');
  };

  const cancelListSortEditor = () => {
    setSortDraft(null);
    setSortNewFieldId('');
    setListOverlayMode(null);
    setListSelectedFiltId(null);
  };

  const doneListSortEditor = () => {
    if (sortDraft) setListSortBy(sortDraft);
    setSortDraft(null);
    setSortNewFieldId('');
    setListOverlayMode(null);
    setListSelectedFiltId(null);
  };

  const updateSortDraftRule = (index: number, patch: Partial<LayoutSort>) => {
    setSortDraft((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  };

  const removeSortDraftRule = (index: number) => {
    setSortDraft((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  };

  const addSortDraftRule = () => {
    setSortDraft((prev) => {
      if (!prev || prev.length >= MAX_SORT_RULES || !sortNewFieldId) return prev;
      return [...prev, { fieldId: sortNewFieldId, direction: 'asc' as const }];
    });
    setSortNewFieldId('');
  };

  const closeListOverlay = () => {
    if (listOverlayMode === 'edit-sort') {
      cancelListSortEditor();
      return;
    }
    if (listOverlayMode === 'edit-filter') {
      cancelListFilterEditor();
      return;
    }
    setListOverlayMode(null);
    setListSelectedFiltId(null);
  };

  const saveListMetadata = async () => {
    if (!layoutId) return;
    setListSavingMeta(true);
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: layoutId,
          name: layoutName.trim() || layoutSystemName,
          description: layoutDescription.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');
      setShowEditMetaOverlay(false);
    } catch (err: any) {
      console.error('Failed to save layout details:', err);
      alert(err.message);
    } finally {
      setListSavingMeta(false);
    }
  };

  const handleSetAsDefault = async () => {
    if (!layoutId) return;
    setSetDefaultLoading(true);
    try {
      const res = await fetch('/api/console/layouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: layoutId,
          isDefault: true,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to set as default');
      setLayoutIsDefault(true);
      setShowSetDefaultConfirm(false);
    } catch (err: any) {
      console.error('Failed to set layout as default:', err);
      alert(err.message);
    } finally {
      setSetDefaultLoading(false);
    }
  };

  const deleteListLayout = async () => {
    if (!layoutId) return;
    setListDeleteLoading(true);
    try {
      const res = await fetch(`/api/console/layouts?id=${layoutId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete');
      navigate('/admin/views');
    } catch (err: any) {
      console.error('Failed to delete layout:', err);
      alert(err.message);
    } finally {
      setListDeleteLoading(false);
      setShowListDeleteConfirm(false);
    }
  };

  // ── Runtime Preview Actions ──
  const handleListRuntimeSort = (columnId: string) => {
    const col = listColumns.find((c) => c.id === columnId);
    if (!col) return;
    setListRuntimeSortRules((prev) => {
      if (prev.length > 0 && prev[0].fieldId === col.fieldId) {
        if (prev[0].direction === 'asc') return [{ fieldId: col.fieldId, direction: 'desc' }];
        return [];
      }
      return [{ fieldId: col.fieldId, direction: 'asc' }];
    });
  };

  const handleListRuntimeFilter = (fieldId: string, value: string) => {
    setListRuntimeFilters((prev) => ({ ...prev, [fieldId]: value }));
  };

  const toggleListSelectRecord = (rowIndex: number) => {
    setListSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleListSelectAll = () => {
    setListSelectedIndices((prev) => {
      const next = new Set(prev);
      if (listAllSelectedOnPage) {
        listCurrentPageRecords.forEach((_, i) => next.delete(i));
      } else {
        listCurrentPageRecords.forEach((_, i) => next.add(i));
      }
      return next;
    });
  };

  const goToListPage = (page: number) => {
    setListCurrentPage(Math.max(1, Math.min(listTotalPages, page)));
  };

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    if (previewMode || isReadOnly) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setDragOverSection(null);
    setDragOverBlockId(null);
    setDragOverChildBlockId(null);
    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData('application/json'));

      if (dragOverTabBlockId && payload.type === 'palette') {
        const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
        if (tabBlock?.tabs) {
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock.tabs[activeIdx];
          if (activeTab) {
            const item = palette.find((p) => p.id === payload.paletteId);
            if (item && item.blockType !== 'tab_group') {
              addBlockToTab(dragOverTabBlockId, activeTab.id, item, dragOverChildBlockId || undefined);
            }
          }
        }
        setDragOverTabBlockId(null);
        return;
      }

      if (dragOverTabBlockId && payload.type === 'placed' && payload.blockId && dragOverChildBlockId && payload.sourceTabBlockId === dragOverTabBlockId) {
        const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
        if (tabBlock?.tabs) {
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock.tabs[activeIdx];
          if (activeTab) {
            setBlocks((prev) =>
              prev.map((blk) => {
                if (blk.id !== dragOverTabBlockId || !blk.tabs) return blk;
                return {
                  ...blk,
                  tabs: blk.tabs.map((tab) => {
                    if (tab.id !== activeTab.id) return tab;
                    const list = [...tab.blocks];
                    const sourceIdx = list.findIndex((b) => b.id === payload.blockId);
                    const targetIdx = list.findIndex((b) => b.id === dragOverChildBlockId);
                    if (sourceIdx === -1 || targetIdx === -1) return tab;
                    const updated = list.map((b, i) => {
                      if (i === sourceIdx) return { ...b, position: targetIdx };
                      if (i === targetIdx) return { ...b, position: sourceIdx };
                      return b;
                    });
                    return { ...tab, blocks: updated };
                  }),
                };
              })
            );
          }
        }
        setDragOverTabBlockId(null);
        setDragOverChildBlockId(null);
        return;
      }

      if (dragOverTabBlockId && payload.type === 'placed' && payload.blockId) {
        const draggedBlock = findBlockById(payload.blockId);
        if (draggedBlock && draggedBlock.blockType !== 'tab_group') {
          const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock?.tabs?.[activeIdx];
          if (activeTab) {
            moveBlockToTab(payload.blockId, dragOverTabBlockId, activeTab.id);
          }
        }
        setDragOverTabBlockId(null);
        return;
      }

      if (payload.type === 'palette') {
        const item = palette.find((p) => p.id === payload.paletteId);
        if (item) addBlock(item, targetSectionId, dragOverBlockId || undefined);
      } else if (payload.type === 'placed' && payload.blockId) {
        const draggedBlock = findBlockById(payload.blockId);
        if (!draggedBlock) return;

        if (payload.sourceTabBlockId) {
          if (dragOverBlockId) {
            setBlocks((prev) => {
              const mid = prev
                .filter((blk) => blk.id !== payload.blockId)
                .map((blk) => {
                  if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
                  return {
                    ...blk,
                    tabs: blk.tabs.map((tab) => ({
                      ...tab,
                      blocks: tab.blocks.filter((tb) => tb.id !== payload.blockId),
                    })),
                  };
                });
              const sectionBlocks = mid
                .filter((b) => b.sectionId === targetSectionId)
                .sort((a, b) => a.position - b.position);
              const targetIdx = sectionBlocks.findIndex((b) => b.id === dragOverBlockId);
              if (targetIdx === -1) return prev;
              const placed: PlacedBlock = { ...draggedBlock, sectionId: targetSectionId, position: targetIdx };
              return mid.map((blk) => {
                if (blk.sectionId !== targetSectionId) return blk;
                const pos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (pos >= targetIdx) return { ...blk, position: blk.position + 1 };
                return blk;
              }).concat(placed);
            });
          } else {
            moveBlockToSection(payload.blockId, targetSectionId);
          }
        } else if (targetSectionId === payload.sourceSectionId && dragOverBlockId) {
          const sectionBlocks = blocksBySection[targetSectionId] || [];
          const targetIdx = sectionBlocks.findIndex((b) => b.id === dragOverBlockId);
          if (targetIdx === -1) return;

          setBlocks((prev) => {
            const updated = prev.map((blk) => {
              if (blk.id === payload.blockId) return { ...blk, position: targetIdx };
              const sourceIdx = sectionBlocks.findIndex((b) => b.id === payload.blockId);
              if (sourceIdx < targetIdx) {
                const sectionPos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (blk.sectionId === targetSectionId && sectionPos > sourceIdx && sectionPos <= targetIdx) {
                  return { ...blk, position: blk.position - 1 };
                }
              } else if (sourceIdx > targetIdx) {
                const sectionPos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (blk.sectionId === targetSectionId && sectionPos >= targetIdx && sectionPos < sourceIdx) {
                  return { ...blk, position: blk.position + 1 };
                }
              }
              return blk;
            });
            return updated;
          });
        } else if (targetSectionId !== payload.sourceSectionId) {
          moveBlockToSection(payload.blockId, targetSectionId);
        }
      }
    } catch {}
  };

  const handleBlockDrop = (e: React.DragEvent, targetBlockId: string, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setDragOverBlockId(targetBlockId);
    setDragOverTabBlockId(null);
    setDragOverChildBlockId(null);
  };

  const handleResizeStart = (e: React.MouseEvent, blockId: string, currentSpan: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    const grid = (e.currentTarget as HTMLElement).closest('.ls-section__grid') as HTMLElement;
    pushGestureSnapshot();
    setResizing({ blockId, startX: e.clientX, startSpan: currentSpan, sectionElement: grid });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className={`ls-root ${previewMode ? 'ls-root--preview' : ''} ${isReadOnly ? 'ls-root--readonly' : ''}`}>
      <div className="ls-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => navigate('/admin/views')} title="Back">
            <ArrowLeft size={14} />
          </button>
          <span className="ls-toolbar__brand">Layout Studio</span>
          <span style={{ fontSize: 11, color: 'var(--sails-text-muted)' }}>— {tableMeta.name}{viewType === 'LIST' ? ' (List View)' : ''}</span>
          <span className={`ls-version-badge ${layoutStatus === 'draft' ? 'ls-version-badge--draft' : layoutStatus === 'active' ? 'ls-version-badge--active' : ''}`}>
            {layoutStatus === 'draft' ? `Draft v${currentVersion}${isEditing ? ' (editing)' : ''}` : layoutStatus === 'active' ? `Active v${layoutVersions[0]?.version ?? Math.max(1, currentVersion - 1)}` : ''}
          </span>
        </div>
        <div className="ls-toolbar__actions">
          {previewMode ? (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setPreviewMode(false)}>
              <Pause size={14} /> Exit Preview
            </button>
          ) : isReadOnly ? (
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowEditMetaOverlay(true)}>
                <Settings size={12} /> Edit Details
              </button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={handleStartEdit}>
                <Edit3 size={14} /> Edit Layout
              </button>
            </>
          ) : layoutStatus === 'draft' && !isEditing ? (
            /* Shouldn't normally happen, but handle gracefully */
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowEditMetaOverlay(true)}>
                <Settings size={12} /> Edit Details
              </button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={handleStartEdit}>
                <Edit3 size={14} /> Edit Layout
              </button>
            </>
          ) : (
            <>
              <button
                className="sails-btn sails-btn--ghost sails-btn--sm"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button
                className="sails-btn sails-btn--ghost sails-btn--sm"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo"
              >
                <Redo2 size={14} />
              </button>
              <span className="ls-toolbar__divider" />
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              {layoutStatus === 'draft' && (
                <>
                  <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(true)}>
                    Reset
                  </button>
                  {isEditing && hasPublishedVersion && (
                    <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowDiscardConfirm(true)}>
                      <Undo2 size={13} /> Discard Changes
                    </button>
                  )}
                  <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowEditMetaOverlay(true)}>
                    <Settings size={12} /> Edit Details
                  </button>
                  <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={handleSaveClick} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setShowActivateConfirm(true)}>
                    <Zap size={14} /> Activate
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {savedSuccessMsg && (
        <div className="ls-toast-success">
          <CheckCircle2 size={16} />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {isReadOnly && (
        <div className="ls-status-banner ls-status-banner--active">
          <CheckCircle2 size={14} />
          <span>Active — layout is read-only. Click <strong>Edit Layout</strong> to make changes.</span>
        </div>
      )}
      {layoutStatus === 'draft' && isEditing && (
        <div className="ls-status-banner ls-status-banner--draft">
          <Edit3 size={14} />
          <span>Editing draft — changes won't affect users until <strong>activated</strong>.</span>
        </div>
      )}

      <div className="ls-body" style={{ gridTemplateColumns: (() => {
        if (previewMode) return '1fr';
        const pw = showProperties ? propsWidth : 36;
        const lw = paletteWidth;
        const leftCol = paletteFloating ? '' : `${lw}px `;
        const rightCol = propsFloating ? '' : ` ${pw}px`;
        return `${leftCol}1fr${rightCol}`;
      })() }}>
        {/* ── LEFT: Palette ── */}
        {!previewMode && !isReadOnly && (
        <div className={`ls-palette-outer ${paletteFloating ? 'ls-palette-outer--floating' : ''} ${paletteVisible ? 'ls-palette-outer--open' : ''}`}
          style={{ width: paletteFloating ? (paletteVisible ? paletteWidth : 36) : '100%' }}
          onMouseEnter={() => { if (paletteFloating) setPaletteVisible(true); }}
          onMouseLeave={() => { if (paletteFloating) setPaletteVisible(false); }}
        >
          {paletteVisible && (
            <>
          <div className="ls-palette-resize" onMouseDown={(e) => { e.preventDefault(); setPaletteResizing(true); }} />
          <div className="ls-palette">
          <div className="ls-palette__header">
            <h3 className="ls-panel-title"><LayoutGrid size={13} /> {viewType === 'LIST' ? 'Fields' : 'Fields'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="ls-palette__count">{viewType === 'LIST' ? allFields.filter((f) => !listColumnFieldIds.includes(f.id)).length : palette.filter(p => p.blockType === 'field').length}</span>
              <button className="ls-block__btn" onClick={() => setPaletteFloating(!paletteFloating)} title={paletteFloating ? 'Dock palette' : 'Float palette'}>
                {paletteFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>
          </div>
          {viewType === 'LIST' ? (
            <div className="ls-palette__fields">
              <div className="ls-palette__group-label">AVAILABLE FIELDS</div>
              {allFields.filter((f) => !listColumnFieldIds.includes(f.id)).map((f) => (
                <div key={f.id} className="ls-palette-field"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ fieldId: f.id }))}
                  onClick={() => addListColumn(f.id)}>
                  <GripVertical size={12} /><span>{f.name}</span>
                  <span className="ls-type-tag">{f.logicalType}</span>
                  <ArrowRight size={12} className="ls-add-icon" />
                </div>
              ))}
              {listColumnFieldIds.length > 0 && (
                <>
                  <div className="ls-palette__group-label">IN VIEW</div>
                  {listColumnFieldIds.map((pfId) => {
                    const f = allFields.find((ff) => ff.id === pfId);
                    if (!f) return null;
                    return (
                      <div key={pfId} className="ls-palette-field ls-palette-field--placed">
                        <span>{f.name}</span>
                        <span className="ls-type-tag">{f.logicalType}</span>
                        <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); const col = listColumns.find((c) => c.fieldId === pfId); if (col) removeListColumn(col.id); }} title="Remove column"><X size={10} /></button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <>
          <button className="sails-btn sails-btn--ghost sails-btn--sm ls-palette__add-section" onClick={addSection}>
            <Plus size={13} /> Add Section
          </button>
          <div className="ls-palette__fields">
            {palette.filter(p => p.blockType === 'field').length === 0 && palette.filter(p => p.blockType !== 'field').length === 0 ? (
              <p className="ls-empty">All blocks placed</p>
            ) : (
              <>
                {palette.some(p => p.blockType === 'field') && <div className="ls-palette__group-label">DATA FIELDS</div>}
                {palette.filter(p => p.blockType === 'field').map((item) => {
                  const fd = allFields.find((f) => f.id === item.fieldId);
                  return (
                    <div key={item.id} className="ls-palette-field" draggable
                      onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, fieldId: item.fieldId, paletteId: item.id })}
                      onClick={() => addBlock(item, sections[0]?.id || '')}>
                      <GripVertical size={12} /><span>{item.label}</span>
                      <span className="ls-type-tag">{fd?.logicalType}</span>
                      <ArrowRight size={12} className="ls-add-icon" />
                    </div>
                  );
                })}

                {palette.some(p => p.blockType === 'related_list') && <div className="ls-palette__group-label">RELATIONS</div>}
                {palette.filter(p => p.blockType === 'related_list').map((item) => (
                  <div key={item.id} className="ls-palette-field ls-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="ls-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="ls-add-icon" />
                  </div>
                ))}

                {palette.some(p => p.blockType === 'tab_group') && <div className="ls-palette__group-label">LAYOUT</div>}
                {palette.filter(p => p.blockType === 'tab_group').map((item) => (
                  <div key={item.id} className="ls-palette-field ls-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="ls-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="ls-add-icon" />
                  </div>
                ))}
              </>
            )}
          </div>
            </>
          )}
        </div>
            </>
          )}
          {!paletteVisible && (
            <div className="ls-palette-tab" onClick={() => setPaletteVisible(true)}>
              <LayoutGrid size={14} />
            </div>
          )}
          </div>
        )}

        {/* ── CENTER: Canvas ── */}
        <div className="ls-canvas" onClick={(e) => { if (e.target === e.currentTarget) handleCanvasDeselect(); }}>
          <div className="ls-canvas__scroll" onClick={(e) => { if (e.target === e.currentTarget) handleCanvasDeselect(); }}>
            <div className="ls-page" onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCanvasDeselect();
              }
            }}>
              {viewType === 'LIST' ? (
                <>
              {/* ── View Name ── */}
              <div className="ls-page__header" onClick={handleCanvasDeselect}>
                <h1 className="ls-page__title">{tableMeta.name}</h1>
                <p className="ls-page__subtitle">Select columns, define filters and sort order to build your list view.</p>
              </div>

              {/* ── Summary Panel ── */}
              {!previewMode && !isReadOnly && (
              <div className="ls-table-card ls-summary-panel"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  try {
                    const payload = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (payload.fieldId) addListSummaryField(payload.fieldId);
                  } catch { /* ignore */ }
                }}>
                <div className="ls-table-card__header">
                  <Layers size={13} />
                  <span className="ls-table-card__title">Summary Panel</span>
                  {listSummaryFields.length > 0 && <span className="ls-table-card__badge">{listSummaryFields.length}</span>}
                </div>
                <div className="ls-summary-panel__body">
                  {listSummaryFields.length === 0 ? (
                    <div className="ls-summary-panel__placeholder">
                      <Layers size={18} className="ls-summary-panel__placeholder-icon" />
                      <span>Drag fields here to group or summarize</span>
                    </div>
                  ) : (
                    <div className="ls-summary-fields">
                      {listSummaryFields.map((sf) => {
                        const f = allFields.find((ff) => ff.id === sf.fieldId);
                        if (!f) return null;
                        return (
                          <div key={sf.id} className="ls-summary-field">
                            <span className="ls-summary-field__name">{f.name}</span>
                            <span className="ls-summary-field__tag">Group By</span>
                            <button className="ls-block__btn ls-block__btn--danger" onClick={() => removeListSummaryField(sf.fieldId)}><X size={11} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* ── Actions Card ── */}
              {!previewMode && !isReadOnly && (
              <div className="ls-table-card ls-summary-panel ls-actions-card">
                <div className="ls-table-card__header">
                  <MousePointerClick size={13} />
                  <span className="ls-table-card__title">Actions</span>
                  {listActions.length > 0 && <span className="ls-table-card__badge">{listActions.length}</span>}
                  {availableListActionPlugins.filter((p) => !isActionEnabled(p.id)).map((plugin) => (
                    <button key={plugin.id} className="ls-block__btn" title={`Add ${plugin.name}`}
                      onClick={() => toggleListAction(plugin.id)}
                      style={{ marginLeft: 'auto' }}>
                      <Plus size={13} />
                    </button>
                  ))}
                </div>
                <div className="ls-summary-panel__body">
                  {listActions.length === 0 ? (
                    <div className="ls-summary-panel__placeholder" style={{ flexDirection: 'row', gap: 8, padding: '4px 0', justifyContent: 'center' }}>
                      <MousePointerClick size={14} className="ls-summary-panel__placeholder-icon" />
                      <span>No actions configured. Click + to add one.</span>
                    </div>
                  ) : (
                    <div className="ls-summary-fields">
                      {listActions.map((action) => {
                        const isSelected = listSelectedActionId === action.id;
                        const plugin = actionRegistry.getAction(action.actionKey);
                        const icon = plugin?.iconName || 'Plus';
                        return (
                          <div key={action.id}
                            tabIndex={0}
                            role="button"
                            aria-selected={isSelected}
                            className={`ls-summary-field ${isSelected ? 'ls-summary-field--selected' : ''}`}
                            style={{ cursor: 'pointer', outline: isSelected ? '2px solid var(--sails-primary, #6366f1)' : undefined }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setListSelectedActionId(action.id);
                                setListSelectedColId(null);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setListSelectedActionId(action.id);
                              setListSelectedColId(null);
                            }}>
                            <DynamicIcon name={icon} size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                            <span className="ls-summary-field__name">{action.label}</span>
                            <span className="ls-summary-field__tag">{action.variant.charAt(0).toUpperCase() + action.variant.slice(1)}</span>
                            <button className="ls-block__btn ls-block__btn--danger"
                              title={`Remove ${action.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (listSelectedActionId === action.id) setListSelectedActionId(null);
                                toggleListAction(action.actionKey);
                              }}>
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* ── Columns + Table ── */}
              <div className="ls-table-card">
                <div className="ls-table-card__header">
                  <Columns size={13} />
                  <span className="ls-table-card__title">{previewMode ? tableMeta.name : 'Columns'}</span>
                  {!previewMode && !isReadOnly && (
                    <>
                      <span className="ls-table-card__badge">{listColumns.length}</span>
                      <span style={{ fontSize: 11, color: 'var(--sails-text-muted)', marginLeft: 4 }}>({visibleListColumns.length} visible)</span>
                    </>
                  )}
                  <span className="ls-table-card__badge" style={{ marginLeft: 'auto' }}>
                    {previewMode ? listRuntimeRecords.length : listSortedRecords.length} rows
                  </span>
                  {previewMode && listAllowMultiSelect && listSelectedIndices.size > 0 && (
                    <span className="ls-table-card__badge" style={{ background: 'rgba(157,206,224,0.25)', color: 'var(--sails-primary)' }}>
                      {listSelectedIndices.size} selected
                    </span>
                  )}
                  {previewMode && listRuntimeSortRules.length > 0 && (
                    <button className="ls-block__btn" onClick={() => setListRuntimeSortRules([])} title="Reset sort" style={{ marginLeft: 4 }}>
                      <RotateCcw size={11} />
                    </button>
                  )}
                </div>
                <div className="ls-table-card__body" style={{ padding: 0 }}>
                  {listColumns.length === 0 ? (
                    <div style={{ padding: 16 }}><p className="ls-empty">No columns added. Click a field from the palette.</p></div>
                  ) : (previewMode || isReadOnly) ? (
                    /* ── Runtime Preview Table ── */
                    <div className="ls-preview-wrap">
                      <table className="ls-runtime-table">
                        <thead>
                          <tr>
                            {listAllowMultiSelect && (
                              <th className="ls-rth ls-rth--cb" style={{ width: 40, minWidth: 40 }}>
                                <div className="ls-rth__inner" style={{ justifyContent: 'center' }}>
                                  <input type="checkbox" checked={listCurrentPageRecords.length > 0 && listAllSelectedOnPage}
                                    ref={(el) => { if (el) el.indeterminate = !listAllSelectedOnPage && listCurrentPageRecords.some((_, i) => listSelectedIndices.has(i)); }}
                                    onChange={toggleListSelectAll} title="Select all on page" />
                                </div>
                              </th>
                            )}
                            {sortedListColumns.filter((c) => c.visible).map((col) => {
                              const f = allFields.find((ff) => ff.id === col.fieldId);
                              if (!f) return null;
                              const runtimeSortIdx = listRuntimeSortRules.findIndex((r) => r.fieldId === col.fieldId);
                              const isSorted = runtimeSortIdx !== -1;
                              const sortDir = isSorted ? listRuntimeSortRules[runtimeSortIdx].direction : null;
                              const isFiltering = !!listRuntimeFilters[col.fieldId]?.trim();
                              return (
                                <th key={col.id}
                                  ref={(el) => { filterThRefs.current[col.id] = el; }}
                                  className={`ls-rth ${col.allowSorting ? 'ls-rth--sortable' : ''} ${isSorted ? 'ls-rth--sorted' : ''}`}
                                  style={{ ...(col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : {}), textAlign: col.alignment || (NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}>
                                  <div className="ls-rth__inner">
                                    {col.allowSorting ? (
                                      <button className="ls-rth__sort-btn" onClick={() => handleListRuntimeSort(col.id)}>
                                        <span className="ls-rth__label">{col.labelOverride || f.name}</span>
                                        <span className="ls-rth__sort-indicator">
                                          {isSorted ? (
                                            sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                          ) : (
                                            <ArrowUpDown size={11} className="ls-rth__sort-icon" />
                                          )}
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="ls-rth__label">{col.labelOverride || f.name}</span>
                                    )}
                                    {col.allowFiltering && (
                                      <div className="ls-rth__filter-wrap">
                                        <button className={`ls-rth__filter-btn ${isFiltering ? 'ls-rth__filter-btn--active' : ''}`}
                                          onClick={(e) => { e.stopPropagation(); setListActivePreviewFilter(listActivePreviewFilter === col.fieldId ? null : col.fieldId); }}
                                          title="Filter this column"><Search size={11} /></button>
                                        {listActivePreviewFilter === col.fieldId && (
                                          <SailsPopover
                                            open
                                            triggerRef={{ current: filterThRefs.current[col.id] }}
                                            align="right"
                                            className="ls-rth__filter-popover"
                                            deps={[!!listRuntimeFilters[col.fieldId]]}
                                            onClose={() => setListActivePreviewFilter(null)}
                                          >
                                            <div onClick={(e) => e.stopPropagation()}>
                                              <input className="sails-input" value={listRuntimeFilters[col.fieldId] || ''}
                                                onChange={(e) => handleListRuntimeFilter(col.fieldId, e.target.value)}
                                                placeholder={`Filter ${col.labelOverride || f.name}...`} autoFocus
                                                style={{ fontSize: 12, padding: '5px 8px', width: 180 }} />
                                              {listRuntimeFilters[col.fieldId]?.trim() && (
                                                <button className="ls-rth__filter-clear" onClick={() => { handleListRuntimeFilter(col.fieldId, ''); setListActivePreviewFilter(null); }}>
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
                          {listCurrentPageRecords.map((rec, ri) => {
                            const globalIndex = listAllowPaging ? (listSafeCurrentPage - 1) * listRecordsPerPage + ri : ri;
                            return (
                              <tr key={ri} className={`ls-rtd-row ${listSelectedIndices.has(globalIndex) ? 'ls-rtd-row--selected' : ''}`}>
                                {listAllowMultiSelect && (
                                  <td className="ls-rtd ls-rtd--cb" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={listSelectedIndices.has(globalIndex)} onChange={() => toggleListSelectRecord(globalIndex)} />
                                  </td>
                                )}
                                {(() => {
                                  const visibleCols = sortedListColumns.filter((c) => c.visible);
                                  const primaryColId = visibleCols.find((c) => c.isPrimaryLink)?.id || visibleCols[0]?.id;
                                  return visibleCols.map((col) => {
                                    const f = allFields.find((ff) => ff.id === col.fieldId);
                                    const isPrimary = col.id === primaryColId;
                                    if (!f) return <td key={col.id} className={`ls-rtd ${col.wrapText ? 'ls-rtd--wrap' : ''}`} style={{ textAlign: col.alignment || 'left' }}>—</td>;
                                    const val = renderListFieldValue(f, rec);
                                    const cellNode = f.logicalType === 'user'
                                      ? <UserControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                      : f.logicalType === 'phone'
                                        ? <PhoneControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                        : f.logicalType === 'email'
                                          ? <EmailControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                          : f.logicalType === 'lat_lng'
                                            ? <LatLngControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                            : val;
                                    return (
                                      <td key={col.id} className={`ls-rtd ${col.wrapText ? 'ls-rtd--wrap' : ''}`} style={{ textAlign: col.alignment || (NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}>
                                        {isPrimary ? (
                                          <span className="ls-primary-link" style={{ color: 'var(--sails-primary, #6366f1)', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                                            {val}
                                          </span>
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
                      {listRuntimeRecords.length === 0 && (
                        <div style={{ padding: 32, textAlign: 'center' }}><p className="ls-empty">No records match the current filters.</p></div>
                      )}
                      {listAllowPaging && listRuntimeRecords.length > 0 && (
                        <div className="ls-pagination">
                          <div className="ls-pagination__info">
                            <span className="ls-pagination__range">
                              Showing <strong>{(listSafeCurrentPage - 1) * listRecordsPerPage + 1}</strong> to <strong>{Math.min(listSafeCurrentPage * listRecordsPerPage, listRuntimeRecords.length)}</strong> of <strong>{listRuntimeRecords.length}</strong>
                            </span>
                            {listPagingMode === 'dynamic' && (
                              <div className="ls-pagination__page-size">
                                <span className="ls-pagination__page-size-label">Records per page:</span>
                                <CustomSelect value={listRecordsPerPage} options={LIST_PER_PAGE_OPTIONS}
                                  onChange={(v: number) => { setListRecordsPerPage(v); setListCurrentPage(1); }} size="sm" />
                              </div>
                            )}
                          </div>
                          <div className="ls-pagination__controls">
                            <button className="ls-pagination__btn" disabled={listSafeCurrentPage <= 1} onClick={() => goToListPage(listSafeCurrentPage - 1)}><ChevronLeft size={14} /></button>
                            {listPageNumbers.map((p, i) =>
                              p === 'ellipsis' ? <span key={`e-${i}`} className="ls-pagination__ellipsis">...</span>
                                : listSafeCurrentPage === p
                                  ? <span key={p} className="ls-pagination-page ls-pagination-page--active">{p}</span>
                                  : <button key={p} className="ls-pagination-page ls-pagination-page--clickable" onClick={() => goToListPage(p)}>{p}</button>
                            )}
                            <button className="ls-pagination__btn" disabled={listSafeCurrentPage >= listTotalPages} onClick={() => goToListPage(listSafeCurrentPage + 1)}><ChevronRight size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Builder Table ── */
                    <div className="ls-preview-wrap">
                      <table className="ls-preview-table">
                        <thead>
                          <tr>
                            {listAllowMultiSelect && (
                              <th className="ls-th ls-th--cb" style={{ width: 40, minWidth: 40, cursor: 'default' }}>
                                <div className="ls-th__inner" style={{ justifyContent: 'center' }}>
                                  <input type="checkbox" disabled title="Selection preview — active in builder mode" />
                                </div>
                              </th>
                            )}
                            {sortedListColumns.map((col) => {
                              const f = allFields.find((ff) => ff.id === col.fieldId);
                              if (!f) return null;
                              const isSelected = listSelectedColId === col.id;
                              const isDragOver = listDragOverColId === col.id;
                              return (
                                <th key={col.id}
                                  className={`ls-th ${isSelected ? 'ls-th--selected' : ''} ${!col.visible ? 'ls-th--hidden' : ''} ${isDragOver ? 'ls-th--drag-over' : ''} ${listColResizing?.columnId === col.id ? 'ls-th--resizing' : ''}`}
                                  draggable={!listColResizing}
                                  onDragStart={(e) => { if (listColResizing) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify({ columnId: col.id })); }}
                                  onDragOver={(e) => { if (listColResizing) return; e.preventDefault(); e.stopPropagation(); setListDragOverColId(col.id); }}
                                  onDragLeave={() => setListDragOverColId(null)}
                                  onDrop={(e) => { e.preventDefault(); try { const p = JSON.parse(e.dataTransfer.getData('application/json')); if (p.columnId) handleListColumnDrop(p.columnId, col.id); } catch {} setListDragOverColId(null); }}
                                  onClick={() => {
                                    setListSelectedColId(col.id);
                                    setListSelectedActionId(null);
                                  }}
                                  style={col.width ? { width: `${col.width}${col.widthUnit || 'px'}` } : undefined}>
                                  <div className="ls-th__inner">
                                    <GripVertical size={12} className="ls-th__grip" />
                                    <span className="ls-th__label">{col.labelOverride || f.name}</span>
                                    {!col.visible && <span className="ls-th__hidden-badge">hidden</span>}
                                    <div className="ls-th__actions">
                                      <button className="ls-th__action" onClick={(e) => { e.stopPropagation(); toggleListColumnVisible(col.id); }} title={col.visible ? 'Hide column' : 'Show column'}>
                                        {col.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                      </button>
                                      <button className="ls-th__action ls-th__action--remove" onClick={(e) => { e.stopPropagation(); removeListColumn(col.id); }} title="Remove column"><X size={11} /></button>
                                    </div>
                                  </div>
                                  <div className="ls-th__resize" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement; pushGestureSnapshot(); setListColResizing({ columnId: col.id, startX: e.clientX, startWidth: th.offsetWidth, widthUnit: col.widthUnit || '%' }); }} />
                                </th>
                              );
                            })}
                            <th className="ls-th ls-th--add" onClick={() => { const next = allFields.find((f) => !listColumnFieldIds.includes(f.id)); if (next) addListColumn(next.id); }} title="Add a column"><Plus size={14} /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {listSortedRecords.map((rec, ri) => (
                            <tr key={ri}>
                              {listAllowMultiSelect && (
                                <td className="ls-td ls-td--cb" style={{ width: 40, minWidth: 40, textAlign: 'center', padding: '8px 0' }}>
                                  <input type="checkbox" disabled title="Selection preview" />
                                </td>
                              )}
                              {sortedListColumns.map((col) => {
                                const f = allFields.find((ff) => ff.id === col.fieldId);
                                if (!f) return <td key={col.id} className={`ls-td ${!col.visible ? 'ls-td--hidden' : ''}`} style={{ textAlign: col.alignment || 'left' }}>—</td>;
                                const isPrimary = col.isPrimaryLink;
                                const val = renderListFieldValue(f, rec);
                                const cellNode = f.logicalType === 'user'
                                  ? <UserControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                  : f.logicalType === 'phone'
                                    ? <PhoneControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                    : f.logicalType === 'email'
                                      ? <EmailControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                      : f.logicalType === 'lat_lng'
                                        ? <LatLngControl.RenderDisplay field={f} value={rec[f.fieldName]} />
                                        : val;
                                return (
                                  <td key={col.id} className={`ls-td ${!col.visible ? 'ls-td--hidden' : ''} ${col.wrapText ? 'ls-td--wrap' : ''}`} style={{ textAlign: col.alignment || (NUMERIC_COLUMN_TYPES.has(f.logicalType) ? 'right' : 'left') }}>
                                    {isPrimary ? (
                                      <span
                                        className="ls-primary-link"
                                        style={{ color: 'var(--sails-primary, #6366f1)', fontWeight: 500, cursor: 'default', textDecoration: 'underline' }}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Primary Detail Link Preview"
                                      >
                                        {val}
                                      </span>
                                    ) : (
                                      cellNode
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
                </>
              ) : (
                <>
              {/* ── Page Header ── */}
              <div className="ls-page__header" onClick={handleCanvasDeselect}>
                <h1 className="ls-page__title">{tableMeta.name} Detail</h1>
                <p className="ls-page__subtitle">Drag blocks from the palette to build your page layout</p>
              </div>

              {sections.map((section) => {
                const sectionBlocks = blocksBySection[section.id] || [];
                return (
                  <div key={section.id}
                    className={`ls-section ${selectedSectionId === section.id ? 'ls-section--selected' : ''} ${dragOverSection === section.id ? 'ls-section--drag-over' : ''}`}
                    onClick={() => { if (!isReadOnly) { setSelectedBlockId(null); setSelectedSectionId(section.id); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id); setDragOverBlockId(null); setDragOverTabBlockId(null); }}
                    onDrop={(e) => handleDrop(e, section.id)}>
                    {!(previewMode && section.showHeader === false) && (
                      <div className="ls-section__header" onClick={(e) => { e.stopPropagation(); if (!isReadOnly) handleCanvasDeselect(); }}>
                        {previewMode && section.collapsible && (
                          <button
                            type="button"
                            className="ls-section__collapse-btn"
                            title={previewCollapsedMap[section.id] ? 'Expand section' : 'Collapse section'}
                            onClick={(e) => { e.stopPropagation(); setPreviewCollapsedMap((prev) => ({ ...prev, [section.id]: !(prev[section.id] ?? section.collapsed ?? false) })); }}
                          >
                            {previewCollapsedMap[section.id] ?? section.collapsed ?? false ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        <div className="ls-section__col-btn" title="12-column grid"><Columns size={13} /><span>12-col grid</span></div>
                        <input className="ls-section__title-input" value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} readOnly={isReadOnly} />
                        <button className="ls-section__remove" onClick={(e) => { e.stopPropagation(); removeSection(section.id); }} title="Delete section"><X size={14} /></button>
                      </div>
                    )}
                    {!(previewMode && (previewCollapsedMap[section.id] ?? section.collapsed ?? false)) && (
                    <div className="ls-section__grid">
                      {sectionBlocks.length === 0 ? (
                        <div className="ls-section__empty" style={{ gridColumn: '1 / -1' }}>Drop blocks here from the palette →</div>
                      ) : (
                        sectionBlocks.map((blk, idx) => {
                          const isSelected = selectedBlockId === blk.id;
                          const field = blk.fieldId ? allFields.find((f) => f.id === blk.fieldId) : null;
                          const total = sectionBlocks.length;

                          const controlsEl = (
                            <div className="ls-block__controls">
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                              <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                              <GripVertical size={12} className="ls-block__grip" />
                            </div>
                          );

                          // ── FIELD BLOCK ──
                          if (blk.blockType === 'field' && field) {
                            const condResult = evaluateConditions(blk.conditions, mockRecord, allFields);
                            const hasConditions = blk.conditions && blk.conditions.length > 0;
                            const hasValidations = blk.validations && blk.validations.length > 0;
                            const isConditionalHidden = hasConditions && !condResult;

                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--field ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${isConditionalHidden ? 'ls-block--conditional-hidden' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={(e) => { e.stopPropagation(); if (isReadOnly) return; setSelectedBlockId(blk.id); setSelectedSectionId(null); }}>
                                <div className="ls-block__indicators">
                                  {hasConditions && <span className="ls-indicator ls-indicator--cond" title="Has conditions"><Filter size={10} /></span>}
                                  {hasValidations && <span className="ls-indicator ls-indicator--val" title="Has validation"><ShieldAlert size={10} /></span>}
                                </div>
                                {controlsEl}
                                <label className="ls-block__label">{blk.labelOverride || field.name}{field.isRequired && <span className="ls-block__required">*</span>}</label>
                                {blk.visible ? (
                                  isReadOnly ? (
                                    <div className="ls-block__value">{renderFieldValue(field, mockRecord, blk.controlPluginId, 'display')}</div>
                                  ) : (
                                    renderFieldValue(field, mockRecord, blk.controlPluginId, 'edit', {
                                      inert: !previewMode,
                                      rules: blk.validations,
                                      showErrors: previewMode,
                                      onValueChange: (v) => handleMockValueChange(field.fieldName, v),
                                    })
                                  )
                                ) : <em className="ls-block__empty">hidden</em>}
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">{field.logicalType}</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }

                          // ── RELATED LIST BLOCK ──
                          if (blk.blockType === 'related_list') {
                            const rel = buildRelatedPreview(blk, models);
                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--related ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={(e) => { e.stopPropagation(); if (isReadOnly) return; setSelectedBlockId(blk.id); setSelectedSectionId(null); }}>
                                {controlsEl}
                                <div className="ls-related__header">
                                  <Table2 size={14} />
                                  <span className="ls-related__title">{rel.title}</span>
                                  <span className="ls-related__count">{rel.configured ? `${rel.rows.length} records` : 'unconfigured'}</span>
                                </div>
                                {rel.configured && rel.cols.length > 0 ? (
                                  <table className="ls-related__table">
                                    <thead><tr>{rel.cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                    <tbody>{rel.rows.map((row: any, ri) => <tr key={ri}>{rel.cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                  </table>
                                ) : (
                                  <div className="ls-related__empty" style={{ padding: 16, textAlign: 'center', color: 'var(--sails-text-muted)', fontSize: '0.85rem' }}>
                                    {rel.configured
                                      ? 'This model has no visible fields for preview.'
                                      : 'Select Model, Relation Field & List View in Properties.'}
                                  </div>
                                )}
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">relation</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }

                          // ── TAB GROUP BLOCK ──
                          if (blk.blockType === 'tab_group') {
                            const tabs = blk.tabs || [];
                            const activeTabIdx = activeTabMap[blk.id] ?? 0;
                            const activeTab = tabs[activeTabIdx];
                            const activeBlocks = activeTab?.blocks || [];

                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--tabs ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                onDragOver={(e) => { e.stopPropagation(); handleBlockDrop(e, blk.id, section.id); }}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={(e) => { e.stopPropagation(); if (isReadOnly) return; setSelectedBlockId(blk.id); setSelectedSectionId(null); }}>
                                <div className="ls-block__controls">
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                  <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                                  <span className="ls-block__grip" draggable
                                    onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}>
                                    <GripVertical size={12} />
                                  </span>
                                </div>
                                <div className="ls-tabs__bar">
                                  {tabs.map((tab, ti) => (
                                    <div key={tab.id}
                                      className={`ls-tabs__tab ${ti === activeTabIdx ? 'ls-tabs__tab--active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTabMap((prev) => ({ ...prev, [blk.id]: ti }));
                                      }}>
                                      {tab.label}
                                      {tab.blocks.length > 0 && <span className="ls-tabs__count">{tab.blocks.length}</span>}
                                    </div>
                                  ))}
                                </div>
                                <div
                                  className={`ls-tabs__body ${dragOverTabBlockId === blk.id ? 'ls-tabs__body--drag-over' : ''}`}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverTabBlockId(blk.id);
                                    setDragOverBlockId(null);
                                    setDragOverChildBlockId(null);
                                  }}>
                                  {activeBlocks.length === 0 ? (
                                    <p className="ls-tabs__hint">Drop fields here from the palette</p>
                                  ) : (
                                    <div className="ls-section__grid">
                                      {activeBlocks.map((tb, tIdx) => {
                                        const tbField = tb.fieldId ? allFields.find((f) => f.id === tb.fieldId) : null;
                                        const tbSelected = selectedBlockId === tb.id;
                                        const tbTotal = activeBlocks.length;
                                        const tbControls = (
                                          <div className="ls-block__controls">
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'up'); }} disabled={tIdx === 0}><MoveUp size={10} /></button>
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'down'); }} disabled={tIdx === tbTotal - 1}><MoveDown size={10} /></button>
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(tb.id, { visible: !tb.visible }); }}>{tb.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                            <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(tb.id); }}><Trash2 size={10} /></button>
                                            <GripVertical size={12} className="ls-block__grip" />
                                          </div>
                                        );

                                        if (tb.blockType === 'field' && tbField) {
                                          const condResult = evaluateConditions(tb.conditions, mockRecord, allFields);
                                          const hasConditions = tb.conditions && tb.conditions.length > 0;
                                          const hasValidations = tb.validations && tb.validations.length > 0;
                                          const isCondHidden = hasConditions && !condResult;
                                          const isDragOver = dragOverChildBlockId === tb.id;
                                          return (
                                            <div key={tb.id}
                                              className={`ls-block ls-block--field ${tbSelected ? 'ls-block--selected' : ''} ${!tb.visible ? 'ls-block--hidden' : ''} ${isCondHidden ? 'ls-block--conditional-hidden' : ''} ${isDragOver ? 'ls-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); if (isReadOnly) return; setSelectedBlockId(tb.id); setSelectedSectionId(null); }}>
                                              {tbControls}
                                              <div className="ls-block__indicators">
                                                {hasConditions && <span className="ls-indicator ls-indicator--cond"><Filter size={10} /></span>}
                                                {hasValidations && <span className="ls-indicator ls-indicator--val"><ShieldAlert size={10} /></span>}
                                              </div>
                                              <label className="ls-block__label">{tb.labelOverride || tbField.name}{tbField.isRequired && <span className="ls-block__required">*</span>}</label>
                                              {tb.visible ? (
                                                isReadOnly ? (
                                                  <div className="ls-block__value">{renderFieldValue(tbField, mockRecord, tb.controlPluginId, 'display')}</div>
                                                ) : (
                                                  renderFieldValue(tbField, mockRecord, tb.controlPluginId, 'edit', {
                                                    inert: !previewMode,
                                                    rules: tb.validations,
                                                    showErrors: previewMode,
                                                    onValueChange: (v) => handleMockValueChange(tbField.fieldName, v),
                                                  })
                                                )
                                              ) : <em className="ls-block__empty">hidden</em>}
                                              <span className="ls-block__width-badge">{tb.width} cols</span>
                                              <span className="ls-block__type-badge">{tbField.logicalType}</span>
                                              <div className="ls-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }

                                        if (tb.blockType === 'related_list') {
                                          const rel = buildRelatedPreview(tb, models);
                                          const isDragOver = dragOverChildBlockId === tb.id;
                                          return (
                                            <div key={tb.id}
                                              className={`ls-block ls-block--related ${tbSelected ? 'ls-block--selected' : ''} ${!tb.visible ? 'ls-block--hidden' : ''} ${isDragOver ? 'ls-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); if (isReadOnly) return; setSelectedBlockId(tb.id); setSelectedSectionId(null); }}>
                                              {tbControls}
                                              <div className="ls-related__header">
                                                <Table2 size={14} />
                                                <span className="ls-related__title">{rel.title}</span>
                                                <span className="ls-related__count">{rel.configured ? `${rel.rows.length} records` : 'unconfigured'}</span>
                                              </div>
                                              {rel.configured && rel.cols.length > 0 ? (
                                                <table className="ls-related__table">
                                                  <thead><tr>{rel.cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                                  <tbody>{rel.rows.map((row: any, ri) => <tr key={ri}>{rel.cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                                </table>
                                              ) : (
                                                <div className="ls-related__empty" style={{ padding: 16, textAlign: 'center', color: 'var(--sails-text-muted)', fontSize: '0.85rem' }}>
                                                  {rel.configured
                                                    ? 'This model has no visible fields for preview.'
                                                    : 'Select Model, Relation Field & List View in Properties.'}
                                                </div>
                                              )}
                                              <span className="ls-block__width-badge">{tb.width} cols</span>
                                              <span className="ls-block__type-badge">relation</span>
                                              <div className="ls-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">tabs</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }
                          return null;
                        })
                      )}
                    </div>
                    )}
                  </div>
                );
              })}

              {sections.length === 0 && (
                <div className="ls-page__empty"><p>No sections yet. Click <strong>+ Add Section</strong>.</p></div>
              )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Properties ── */}
        {!previewMode && (
          <div
            className={`ls-props-outer ${showProperties ? 'ls-props-outer--open' : ''} ${propsFloating ? 'ls-props-outer--floating' : ''}`}
            style={{ width: propsFloating ? (showProperties ? propsWidth : 36) : '100%' }}
            onMouseEnter={() => { if (propsFloating) setShowProperties(true); }}
            onMouseLeave={() => { if (propsFloating) setShowProperties(false); }}
          >
            {showProperties && (
              <>
                <div className="ls-props-resize" onMouseDown={(e) => { e.preventDefault(); setPropsResizing(true); }} />
                <div className="ls-properties">
                  <div className="ls-props-header">
                    <h3 className="ls-panel-title"><Settings size={13} /> Properties</h3>
                    <button className="ls-block__btn" onClick={() => {
                      const next = !propsFloating;
                      setPropsFloating(next);
                      if (!next) setShowProperties(true);
                    }} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>
                      {propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>
                  </div>
                  {viewType === 'LIST' ? (
                    <>
                      {(() => {
                        const selectedAction = listActions.find((a) => a.id === listSelectedActionId);
                        if (selectedAction) {
                          return (
                            <>
                              <div className="ls-section-divider">Action Properties</div>
                              <div className="ls-prop__name">{selectedAction.label}</div>

                              <div className="ls-prop-group" style={{ marginBottom: 12 }}>
                                <label className="ls-prop-label">Action Key</label>
                                <span className="ls-prop-type-badge" style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--sails-primary, #6366f1)', border: '1px solid var(--sails-border-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {selectedAction.actionKey}
                                </span>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Label Override</label>
                                <input className="sails-input" value={selectedAction.label || ''}
                                  onChange={(e) => updateListAction(selectedAction.id, { label: e.target.value })}
                                  placeholder={actionRegistry.getAction(selectedAction.actionKey)?.defaultLabel || 'Action Label'} />
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Button Variant</label>
                                <CustomSelect
                                  value={selectedAction.variant}
                                  options={[
                                    { value: 'primary', label: 'Primary' },
                                    { value: 'secondary', label: 'Secondary' },
                                    { value: 'ghost', label: 'Ghost' },
                                    { value: 'danger', label: 'Danger' },
                                  ]}
                                  onChange={(v) => updateListAction(selectedAction.id, { variant: v as ListAction['variant'] })}
                                  size="sm"
                                />
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={selectedAction.visible}
                                    onChange={() => updateListAction(selectedAction.id, { visible: !selectedAction.visible })} /> Visible
                                </label>
                              </div>
                            </>
                          );
                        }

                        if (listSelectedCol) {
                          return (
                            <>
                              <div className="ls-section-divider">Column Properties</div>
                              <div className="ls-prop__name">{allFields.find((f) => f.id === listSelectedCol.fieldId)?.name || listSelectedCol.fieldId}</div>

                              <div className="ls-prop-group" style={{ marginBottom: 12 }}>
                                <label className="ls-prop-label">Data Type</label>
                                <span className="ls-prop-type-badge" style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--sails-primary, #6366f1)', border: '1px solid var(--sails-border-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {allFields.find((f) => f.id === listSelectedCol.fieldId)?.logicalType || 'string'}
                                </span>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={listSelectedCol.allowSorting}
                                    onChange={() => updateListColumn(listSelectedCol.id, { allowSorting: !listSelectedCol.allowSorting } as Partial<LayoutColumn>)} /> Allow Sorting
                                </label>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={listSelectedCol.allowFiltering}
                                    onChange={() => updateListColumn(listSelectedCol.id, { allowFiltering: !listSelectedCol.allowFiltering } as Partial<LayoutColumn>)} /> Allow Filtering
                                </label>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={listSelectedCol.isPrimaryLink || false}
                                    onChange={() => updateListColumn(listSelectedCol.id, { isPrimaryLink: !listSelectedCol.isPrimaryLink } as Partial<LayoutColumn>)} /> Primary Detail Link
                                </label>
                              </div>

                              {listSelectedCol.isPrimaryLink && (
                                <div className="ls-prop-group" style={{ paddingLeft: 22 }}>
                                  <label className="ls-prop-label">Target Form / Detail Layout</label>
                                  <CustomSelect
                                    value={listSelectedCol.targetDetailLayoutId || ''}
                                    options={[
                                      { value: '', label: 'Default Active Detail Layout' },
                                      ...availableDetailLayouts.map((l) => ({ value: l.id, label: `${l.name} (${l.viewType})` }))
                                    ]}
                                    onChange={(v: string | number) => updateListColumn(listSelectedCol.id, { targetDetailLayoutId: String(v) || undefined } as Partial<LayoutColumn>)}
                                    size="sm"
                                  />
                                </div>
                              )}

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={listSelectedCol.visible} onChange={() => toggleListColumnVisible(listSelectedCol.id)} /> Visible
                                </label>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Alignment</label>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className={`sails-btn sails-btn--ghost sails-btn--sm ${listSelectedCol.alignment === 'left' ? 'ls-btn--active' : ''}`}
                                    onClick={() => updateListColumn(listSelectedCol.id, { alignment: 'left' } as Partial<LayoutColumn>)}
                                    title="Align Left" style={{ flex: 1, justifyContent: 'center' }}><AlignLeft size={14} /></button>
                                  <button className={`sails-btn sails-btn--ghost sails-btn--sm ${listSelectedCol.alignment === 'center' ? 'ls-btn--active' : ''}`}
                                    onClick={() => updateListColumn(listSelectedCol.id, { alignment: 'center' } as Partial<LayoutColumn>)}
                                    title="Align Center" style={{ flex: 1, justifyContent: 'center' }}><AlignCenter size={14} /></button>
                                  <button className={`sails-btn sails-btn--ghost sails-btn--sm ${listSelectedCol.alignment === 'right' ? 'ls-btn--active' : ''}`}
                                    onClick={() => updateListColumn(listSelectedCol.id, { alignment: 'right' } as Partial<LayoutColumn>)}
                                    title="Align Right" style={{ flex: 1, justifyContent: 'center' }}><AlignRight size={14} /></button>
                                </div>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={listSelectedCol.wrapText || false}
                                    onChange={() => updateListColumn(listSelectedCol.id, { wrapText: !listSelectedCol.wrapText } as Partial<LayoutColumn>)} /> Wrap Text
                                </label>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Label Override</label>
                                <input className="sails-input" value={listSelectedCol.labelOverride || ''}
                                  onChange={(e) => updateListColumn(listSelectedCol.id, { labelOverride: e.target.value || undefined } as Partial<LayoutColumn>)}
                                  placeholder={allFields.find((f) => f.id === listSelectedCol.fieldId)?.name}
                                  style={{ fontSize: 12, padding: '5px 7px' }} />
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Column Width</label>
                                <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
                                  <input className="sails-input" type="number" value={listSelectedCol.width || ''}
                                    onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; updateListColumn(listSelectedCol.id, { width: v } as Partial<LayoutColumn>); }}
                                    placeholder="auto" style={{ fontSize: 12, padding: '5px 7px', flex: 1, minWidth: 0 }} />
                                  <CustomSelect
                                    value={listSelectedCol.widthUnit || 'px'}
                                    options={[{ value: 'px', label: 'px' }, { value: '%', label: '%' }]}
                                    onChange={(v) => updateListColumn(listSelectedCol.id, { widthUnit: v as 'px' | '%' } as Partial<LayoutColumn>)}
                                    size="sm"
                                    style={{ flexShrink: 0 }}
                                  />
                                </div>
                              </div>

                              <div className="ls-prop-group">
                                <label className="ls-prop-label">Position</label>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="sails-btn sails-btn--ghost sails-btn--sm"
                                    onClick={() => moveListColumn(listSelectedCol.id, 'up')}
                                    disabled={listSelectedCol.position === 0}><ArrowLeft size={12} /> Left</button>
                                  <button className="sails-btn sails-btn--ghost sails-btn--sm"
                                    onClick={() => moveListColumn(listSelectedCol.id, 'down')}
                                    disabled={listSelectedCol.position >= listColumns.length - 1}><ArrowRight size={12} /> Right</button>
                                </div>
                              </div>
                            </>
                          );
                        }

                        return (
                          <>
                            <div className="ls-section-divider">View Properties</div>

                            <div className="ls-prop-group" style={{ marginBottom: 14 }}>
                              <label className="ls-prop-label">Data Model</label>
                              <a
                                href={`/admin/schema/${tableMeta.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ls-model-link-btn"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--sails-primary, #6366f1)',
                                  textDecoration: 'none',
                                  background: 'rgba(99, 102, 241, 0.08)',
                                  border: '1px solid rgba(99, 102, 241, 0.2)',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Open model details in Data Model Module"
                              >
                                <Database size={13} />
                                <span>{tableMeta.name || tableMeta.tableName || 'Data Model'}</span>
                                <ExternalLink size={11} style={{ marginLeft: 2 }} />
                              </a>
                            </div>

                            <div className="ls-prop-group">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                <label className="ls-prop-label" style={{ marginBottom: 0 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <ArrowUpDown size={12} /> Sort By
                                  </span>
                                </label>
                                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={openListSortEditor}
                                  disabled={isReadOnly || listSortBy.length >= MAX_SORT_RULES}
                                  style={{ fontSize: 10, padding: '2px 8px' }}><Plus size={11} /> Add</button>
                              </div>
                              {listSortBy.length === 0 ? (
                                <p className="ls-vp-empty">No sort rules configured</p>
                              ) : (
                                <div className="ls-vp-sort-list">
                                  {listSortBy.map((rule, idx) => {
                                    const sf = allFields.find((f) => f.id === rule.fieldId);
                                    return (
                                      <div key={idx} className={`ls-vp-sort-rule ${isReadOnly ? 'ls-vp-readonly' : ''}`} onClick={() => { if (!isReadOnly) openListSortEditor(); }}>
                                        <span className="ls-vp-sort-rule__seq">{idx + 1}</span>
                                        <span className="ls-vp-sort-rule__field">{sf?.name || rule.fieldId}</span>
                                        <span className="ls-vp-sort-rule__dir">{rule.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
                                        {!isReadOnly && (
                                          <button className="ls-vp-sort-rule__remove" onClick={(e) => { e.stopPropagation(); removeListSortRule(idx); }}><X size={10} /></button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="ls-prop-group">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                <label className="ls-prop-label" style={{ marginBottom: 0 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Filter size={12} /> Filters
                                  </span>
                                </label>
                                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addListFilter}
                                  disabled={isReadOnly}
                                  style={{ fontSize: 10, padding: '2px 8px' }}><Plus size={11} /> Add</button>
                              </div>
                              {listFilters.length === 0 ? (
                                <p className="ls-vp-empty">No filters applied</p>
                              ) : (
                                <div className="ls-vp-filter-list">
                                  {listFilters.map((grp, gi) => (
                                    <div key={grp.id} className="ls-vp-filter-group">
                                      <div className="ls-vp-filter-group-head">
                                        <span className="ls-vp-filter-group-name">Group {grp.name}</span>
                                        {gi > 0 && (
                                          <button
                                            className={`ls-btn-logic ${grp.groupLogic === 'or' ? 'ls-btn-logic--active' : ''}`}
                                            disabled={isReadOnly}
                                            onClick={() => {
                                              setListFilters((gs) => gs.map((g) =>
                                                g.id === grp.id ? { ...g, groupLogic: g.groupLogic === 'or' ? 'and' : 'or' } : g
                                              ));
                                            }}
                                            title="Toggle logic joining with previous group"
                                          >
                                            {grp.groupLogic.toUpperCase()}
                                          </button>
                                        )}
                                        {!isReadOnly && (
                                          <button className="ls-vp-filter-remove" onClick={() => removeListFilterGroup(grp.id)} title="Remove group"><X size={10} /></button>
                                        )}
                                      </div>
                                      {grp.rules.map((r, ri) => {
                                        const ff = allFields.find((fd) => fd.id === r.fieldId);
                                        return (
                                          <div key={r.id} className={`ls-vp-filter-row ${isReadOnly ? 'ls-vp-readonly' : ''}`} onClick={() => { if (!isReadOnly) openListFilterEditor(); }}>
                                            {ri > 0 && <span className="ls-vp-filter-logic">{r.logic.toUpperCase()}</span>}
                                            {ri === 0 && <span className="ls-vp-filter-logic" />}
                                            <span className="ls-vp-filter-field">{r.fieldPath || ff?.name || r.fieldId}</span>
                                            <span className="ls-vp-filter-op">{listOperatorLabel(r.operator)}</span>
                                            {!['is_empty', 'is_not_empty'].includes(r.operator) && (
                                              <span className="ls-vp-filter-value">{r.value || r.refFieldPath || '(empty)'}</span>
                                            )}
                                            {!isReadOnly && (
                                              <button className="ls-vp-filter-remove" onClick={(e) => { e.stopPropagation(); removeListFilterRule(grp.id, r.id); }}><X size={10} /></button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={listAllowMultiSelect} disabled={isReadOnly}
                                  onChange={() => setListAllowMultiSelect((v) => !v)} /> Allow Multiple Selection
                              </label>
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={listAllowPaging} disabled={isReadOnly}
                                  onChange={() => { setListAllowPaging((v) => !v); setListCurrentPage(1); }} /> Allow Paging
                              </label>
                              {listAllowPaging && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22, marginTop: 6 }}>
                                  <div style={{ display: 'flex', gap: 16 }}>
                                    <label className="ls-radio-label">
                                      <input type="radio" name="listPagingMode" checked={listPagingMode === 'fixed'} disabled={isReadOnly}
                                        onChange={() => setListPagingMode('fixed')} /> Fixed
                                    </label>
                                    <label className="ls-radio-label">
                                      <input type="radio" name="listPagingMode" checked={listPagingMode === 'dynamic'} disabled={isReadOnly}
                                        onChange={() => setListPagingMode('dynamic')} /> Dynamic
                                    </label>
                                  </div>
                                  {listPagingMode === 'fixed' && (
                                    <CustomSelect value={listRecordsPerPage} options={LIST_PER_PAGE_OPTIONS}
                                      onChange={(v: number) => { setListRecordsPerPage(v); setListCurrentPage(1); }}
                                      size="sm" style={{ width: '100%' }} />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={listAllowInlineEdit} disabled={isReadOnly}
                                  onChange={() => setListAllowInlineEdit((v) => !v)} /> Allow Inline Edit
                              </label>
                              <span className="ls-prop-hint" style={{ fontSize: 11, color: 'var(--sails-text-muted)', paddingLeft: 22, lineHeight: 1.35 }}>
                                Lets users edit rows in place (hover the pencil icon) wherever this view renders.
                              </span>
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={listAllowInlineCreate} disabled={isReadOnly}
                                  onChange={() => setListAllowInlineCreate((v) => !v)} /> Allow Inline Create
                              </label>
                              <span className="ls-prop-hint" style={{ fontSize: 11, color: 'var(--sails-text-muted)', paddingLeft: 22, lineHeight: 1.35 }}>
                                Turns this view's Create action into an inline new-record row.
                              </span>
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={listAllowInlineDelete} disabled={isReadOnly}
                                  onChange={() => setListAllowInlineDelete((v) => !v)} /> Allow Inline Delete
                              </label>
                              <span className="ls-prop-hint" style={{ fontSize: 11, color: 'var(--sails-text-muted)', paddingLeft: 22, lineHeight: 1.35 }}>
                                Adds a delete button to each row (with confirmation) wherever this view renders.
                              </span>
                            </div>

                            <div className="ls-prop-group">
                              <label className="ls-prop-label" style={{ marginBottom: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Smartphone size={12} /> Mobile View Mode
                                </span>
                              </label>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {(['table', 'accordion', 'card'] as MobileViewMode[]).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    disabled={isReadOnly}
                                    className={`sails-btn sails-btn--ghost sails-btn--sm ${listMobileViewMode === mode ? 'ls-btn--active' : ''}`}
                                    onClick={() => setListMobileViewMode(mode)}
                                    style={{ flex: 1, justifyContent: 'center', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                                  >
                                    {mode === 'table' ? <><Table2 size={13} /> Table</> : mode === 'accordion' ? <><List size={13} /> Accordion</> : <><PanelRight size={13} /> Card</>}
                                  </button>
                                ))}
                              </div>
                              <span className="ls-prop-hint" style={{ fontSize: 11, color: 'var(--sails-text-muted)', marginTop: 4, lineHeight: 1.35 }}>
                                How this list view renders on mobile screens (&le;640px). <strong>Table</strong> keeps the standard horizontal-scroll table. <strong>Accordion</strong> stacks rows as expandable cards using the primary column. <strong>Card</strong> shows one swipeable record card at a time.
                              </span>
                            </div>
                          </>
                        );
                      })()}

                      <div className="ls-prop-group" style={{ marginTop: 'auto', paddingTop: 12 }}>
                        {(() => {
                          const selectedAction = listActions.find((a) => a.id === listSelectedActionId);
                          if (selectedAction) {
                            return (
                              <button className="sails-btn sails-btn--danger sails-btn--sm"
                                disabled={isReadOnly}
                                onClick={() => {
                                  setListSelectedActionId(null);
                                  toggleListAction(selectedAction.actionKey);
                                }}
                                style={{ width: '100%', justifyContent: 'center' }}>
                                <Trash2 size={12} /> Remove Action
                              </button>
                            );
                          }
                          if (listSelectedCol) {
                            return (
                              <button className="sails-btn sails-btn--danger sails-btn--sm"
                                disabled={isReadOnly}
                                onClick={() => removeListColumn(listSelectedCol.id)}
                                style={{ width: '100%', justifyContent: 'center' }}>
                                <Trash2 size={12} /> Remove Column
                              </button>
                            );
                          }
                          return (
                              <button className="sails-btn sails-btn--danger sails-btn--sm"
                                disabled={isReadOnly}
                                onClick={() => setShowListDeleteConfirm(true)}
                                style={{ width: '100%', justifyContent: 'center' }}>
                                <Trash2 size={12} /> Delete Layout
                              </button>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <>{selectedBlock ? (
                    <>
                <div className="ls-prop__name">
                  {selectedBlock.blockType === 'field' ? selectedField?.name :
                   selectedBlock.blockType === 'related_list' ? (selectedBlock.relatedTableLabel || 'Related List View') :
                   'Tab Group'}
                </div>
                <div className="ls-prop__type">{selectedBlock.blockType}</div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">Width</label>
                  <span className="ls-prop-width-readout">{selectedBlock.width} / 12 columns</span>
                </div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">
                    <input type="checkbox" checked={selectedBlock.visible}
                      onChange={(e) => updateBlock(selectedBlock.id, { visible: e.target.checked })} />{' '}Visible
                  </label>
                </div>

                {selectedBlock.blockType === 'field' && (
                  <>
                    <div className="ls-prop-group">
                      <label className="ls-prop-label">Label</label>
                      <input className="sails-input" value={selectedBlock.labelOverride || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { labelOverride: e.target.value })}
                        placeholder={selectedField?.name} style={{ fontSize: 12, padding: '6px 8px' }} />
                    </div>

                    <div className="ls-prop-group">
                      <label className="ls-prop-label">Display Control</label>
                      <select
                        className="sails-input"
                        value={selectedBlock.controlPluginId || (selectedField?.config as any)?.defaultControl || (selectedField?.logicalType === 'boolean' ? 'control:boolean_toggle' : '')}
                        onChange={(e) => updateBlock(selectedBlock.id, { controlPluginId: e.target.value || undefined })}
                        style={{ fontSize: 12, padding: '6px 8px' }}
                      >
                        <option value="">Default (Automatic)</option>
                        {selectedField?.logicalType === 'boolean' ? (
                          <>
                            <option value="control:boolean_toggle">Toggle Switch (Default)</option>
                            <option value="control:boolean_checkbox">Pure Checkbox (No Label)</option>
                            <option value="control:boolean_dropdown">Dropdown (Yes / No)</option>
                          </>
                        ) : (
                          FieldControlRegistry.getInstance().getControlsForType(selectedField?.logicalType || 'short_text').map((ctrl: any) => (
                            <option key={ctrl.id} value={ctrl.id}>{ctrl.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </>
                )}

                {selectedBlock.blockType === 'related_list' && (
                  <>
                    <div className="ls-prop-group">
                      <label className="ls-prop-label">Model (FK to this model)</label>
                      <CustomSelect
                        size="sm"
                        searchable
                        value={selectedBlock.relatedTableName || ''}
                        options={inboundModels.map((t: any) => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                        onChange={(val) => updateBlock(selectedBlock.id, {
                          relatedTableName: String(val),
                          relatedFieldName: undefined,
                          relatedViewId: undefined,
                          relatedTableLabel: inboundModels.find((t: any) => t.tableName === val)?.name,
                        })}
                        placeholder={inboundModels.length === 0 ? 'No models reference this model' : 'Select Model'}
                      />
                    </div>

                    {selectedBlock.relatedTableName && (
                      <div className="ls-prop-group">
                        <label className="ls-prop-label">Relation Field</label>
                        <CustomSelect
                          size="sm"
                          searchable
                          value={selectedBlock.relatedFieldName || ''}
                          options={relatedFkFields.map((f: any) => ({ value: f.fieldName, label: `${f.name} (${f.fieldName})` }))}
                          onChange={(val) => updateBlock(selectedBlock.id, { relatedFieldName: String(val) })}
                          placeholder={relatedFkFields.length === 0 ? 'No FK fields' : 'Select FK field'}
                        />
                      </div>
                    )}

                    {selectedBlock.relatedTableName && (
                      <div className="ls-prop-group">
                        <label className="ls-prop-label">List View</label>
                        <CustomSelect
                          size="sm"
                          searchable
                          value={selectedBlock.relatedViewId || ''}
                          options={(listViewsByTable[selectedBlock.relatedTableName] || []).map((v) => ({ value: v.id, label: v.name }))}
                          onChange={(val) => updateBlock(selectedBlock.id, { relatedViewId: String(val) })}
                          placeholder="Select List View"
                        />
                      </div>
                    )}
                  </>
                )}

                {selectedBlock.blockType === 'tab_group' && (
                  <div className="ls-prop-group">
                    <label className="ls-prop-label">Tabs</label>
                    {(selectedBlock.tabs || []).map((tab, ti) => (
                      <div key={tab.id} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <input className="sails-input" value={tab.label}
                          onChange={(e) => {
                            const tabs = [...(selectedBlock.tabs || [])];
                            tabs[ti] = { ...tabs[ti], label: e.target.value };
                            updateBlock(selectedBlock.id, { tabs });
                          }} style={{ fontSize: 12, padding: '4px 6px', flex: 1 }} />
                        <button className="ls-block__btn ls-block__btn--danger"
                          onClick={() => updateBlock(selectedBlock.id, { tabs: (selectedBlock.tabs || []).filter((_, i) => i !== ti) })}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={() => {
                        const tabs = [...(selectedBlock.tabs || []), { id: `tab_${Date.now()}`, label: 'New Tab', sectionIds: [], blocks: [] }];
                        updateBlock(selectedBlock.id, { tabs });
                      }} style={{ marginTop: 4 }}>
                      <Plus size={12} /> Add Tab
                    </button>
                  </div>
                )}

                {/* ── Conditions (Show/Hide rules) ── */}
                <div className="ls-prop-group">
                  <div className="ls-prop-label" style={{ justifyContent: 'space-between' }}>
                    <span><Filter size={12} /> Conditions</span>
                    <button className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={() => {
                        const conds = [...(selectedBlock.conditions || []), {
                          id: `cond_${Date.now()}`,
                          fieldId: allFields[0]?.id || '',
                          operator: 'eq' as ConditionOp,
                          value: '',
                          logic: 'and' as const,
                        }];
                        updateBlock(selectedBlock.id, { conditions: conds });
                      }}>
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {(selectedBlock.conditions || []).length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--sails-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      No conditions. Block always visible.
                    </p>
                  ) : (
                    (selectedBlock.conditions || []).map((cond, ci) => (
                      <div key={cond.id} className="ls-cond-card">
                        {ci > 0 && (
                          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                            {(['and', 'or'] as const).map((l) => (
                              <button key={l}
                                className={`ls-cond-logic-btn ${cond.logic === l ? 'ls-cond-logic-btn--active' : ''}`}
                                onClick={() => {
                                  const conds = [...(selectedBlock.conditions || [])];
                                  conds[ci] = { ...conds[ci], logic: l };
                                  updateBlock(selectedBlock.id, { conditions: conds });
                                }}>
                                {l.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="ls-cond-body">
                          <select className="sails-input" value={cond.fieldId}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], fieldId: e.target.value };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                            {allFields.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select className="sails-input" value={cond.operator}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], operator: e.target.value as ConditionOp };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', width: 70 }}>
                            <option value="eq">=</option>
                            <option value="neq">≠</option>
                            <option value="gt">&gt;</option>
                            <option value="gte">≥</option>
                            <option value="lt">&lt;</option>
                            <option value="lte">≤</option>
                            <option value="contains">contains</option>
                            <option value="empty">is empty</option>
                            <option value="not_empty">not empty</option>
                          </select>
                          {!['empty', 'not_empty'].includes(cond.operator) && (
                            <input className="sails-input" value={cond.value}
                              onChange={(e) => {
                                const conds = [...(selectedBlock.conditions || [])];
                                conds[ci] = { ...conds[ci], value: e.target.value };
                                updateBlock(selectedBlock.id, { conditions: conds });
                              }} placeholder="value" style={{ fontSize: 10, padding: '3px 4px', width: 70 }} />
                          )}
                          <button className="ls-block__btn ls-block__btn--danger"
                            onClick={() => {
                              updateBlock(selectedBlock.id, {
                                conditions: (selectedBlock.conditions || []).filter((_, i) => i !== ci)
                              });
                            }}><X size={11} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Validation Rules ── */}
                {selectedBlock.blockType === 'field' && (
                  <div className="ls-prop-group">
                    <div className="ls-prop-label" style={{ justifyContent: 'space-between' }}>
                      <span><ShieldAlert size={12} /> Validation</span>
                      <button className="sails-btn sails-btn--ghost sails-btn--sm"
                        onClick={() => {
                          const vals = [...(selectedBlock.validations || []), {
                            id: `val_${Date.now()}`,
                            type: 'required' as ValidationType,
                            message: 'This field is required',
                          }];
                          updateBlock(selectedBlock.id, { validations: vals });
                        }}>
                        <Plus size={11} /> Add
                      </button>
                    </div>
                    {(selectedBlock.validations || []).length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--sails-text-muted)', fontStyle: 'italic', margin: 0 }}>
                        No validation rules.
                      </p>
                    ) : (
                      (selectedBlock.validations || []).map((val, vi) => (
                        <div key={val.id} className="ls-cond-card">
                          <div className="ls-cond-body" style={{ flexWrap: 'wrap' }}>
                            <select className="sails-input" value={val.type}
                              onChange={(e) => {
                                const vals = [...(selectedBlock.validations || [])];
                                vals[vi] = { ...vals[vi], type: e.target.value as ValidationType };
                                updateBlock(selectedBlock.id, { validations: vals });
                              }} style={{ fontSize: 10, padding: '3px 4px', flex: 1, minWidth: 80 }}>
                              <option value="required">Required</option>
                              <option value="cross_field">Cross-Field</option>
                              <option value="regex">Regex Pattern</option>
                              <option value="range">Min / Max</option>
                            </select>
                            <button className="ls-block__btn ls-block__btn--danger"
                              onClick={() => {
                                updateBlock(selectedBlock.id, {
                                  validations: (selectedBlock.validations || []).filter((_, i) => i !== vi)
                                });
                              }}><X size={11} /></button>
                          </div>

                          {val.type === 'cross_field' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                              <select className="sails-input" value={val.dependentFieldId || ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], dependentFieldId: e.target.value };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} style={{ fontSize: 10, padding: '3px 4px' }}>
                                <option value="">— depends on field —</option>
                                {allFields.filter((f) => f.id !== selectedBlock.fieldId).map((f) => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <select className="sails-input" value={val.dependentOperator || 'eq'}
                                  onChange={(e) => {
                                    const vals = [...(selectedBlock.validations || [])];
                                    vals[vi] = { ...vals[vi], dependentOperator: e.target.value as ConditionOp };
                                    updateBlock(selectedBlock.id, { validations: vals });
                                  }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                                  <option value="eq">=</option>
                                  <option value="neq">≠</option>
                                  <option value="gt">&gt;</option>
                                  <option value="lt">&lt;</option>
                                </select>
                                <input className="sails-input" value={val.dependentValue || ''}
                                  onChange={(e) => {
                                    const vals = [...(selectedBlock.validations || [])];
                                    vals[vi] = { ...vals[vi], dependentValue: e.target.value };
                                    updateBlock(selectedBlock.id, { validations: vals });
                                  }} placeholder="value" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              </div>
                            </div>
                          )}

                          {val.type === 'regex' && (
                            <input className="sails-input" value={val.pattern || ''}
                              onChange={(e) => {
                                const vals = [...(selectedBlock.validations || [])];
                                vals[vi] = { ...vals[vi], pattern: e.target.value };
                                updateBlock(selectedBlock.id, { validations: vals });
                              }} placeholder="e.g. ^[A-Z]{3}-\d{4}$" style={{ fontSize: 10, padding: '3px 4px', marginTop: 4 }} />
                          )}

                          {val.type === 'range' && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                              <input className="sails-input" type="number" value={val.min ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], min: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Min" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              <input className="sails-input" type="number" value={val.max ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], max: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Max" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                            </div>
                          )}

                          <input className="sails-input" value={val.message}
                            onChange={(e) => {
                              const vals = [...(selectedBlock.validations || [])];
                              vals[vi] = { ...vals[vi], message: e.target.value };
                              updateBlock(selectedBlock.id, { validations: vals });
                            }} placeholder="Error message" style={{ fontSize: 10, padding: '3px 4px', marginTop: 4 }} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : selectedSection ? (
              <>
                <div className="ls-section-divider">Section Properties</div>
                <div className="ls-prop__name">{selectedSection.title || 'Section'}</div>
                <div className="ls-prop__type">section</div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">Section Title</label>
                  <input className="sails-input" value={selectedSection.title}
                    onChange={(e) => updateSection(selectedSection.id, { title: e.target.value })} />
                </div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">
                    <input type="checkbox" checked={selectedSection.showHeader !== false}
                      onChange={(e) => updateSection(selectedSection.id, { showHeader: e.target.checked })} />{' '}
                    Show Section Header
                  </label>
                  <p className="ls-prop-hint">Displays the section title in the detail page / preview.</p>
                </div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">
                    <input type="checkbox" checked={!!selectedSection.collapsible}
                      onChange={(e) => updateSection(selectedSection.id, { collapsible: e.target.checked })} />{' '}
                    Collapsible
                  </label>
                  <p className="ls-prop-hint">Allows users to collapse / expand this section.</p>
                </div>
              </>
            ) : (
              <>
                <div className="ls-section-divider">Detail View Properties</div>
                <div className="ls-prop__name">Detail View</div>
                <div className="ls-prop__type">detail</div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">Record Title Field</label>
                  <CustomSelect
                    value={layoutRecordTitleField || ''}
                    options={[
                      { label: 'None (Use Default Title)', value: '' },
                      ...allFields.map((f) => ({ label: f.name, value: f.id })),
                    ]}
                    searchable
                    placeholder="Select a field..."
                    onChange={(val) => setLayoutRecordTitleField(val ? String(val) : null)}
                  />
                  <p className="ls-prop-hint">The selected model's field value is used as the detail page title.</p>
                </div>

                <p className="ls-empty" style={{ fontSize: 10 }}>Select a section or block to edit its properties.</p>
              </>
            )}</>
                  )}

                {/* ── Version History ── */}
                <div className="ls-prop-group ls-version-history">
                  <div className="ls-section-divider" style={{ borderTop: 'none', margin: '8px -10px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <History size={12} /> Version History
                    </span>
                  </div>
                  {layoutVersions.length === 0 ? (
                    <p className="ls-vp-empty">No published versions yet. Activate to create version 1.</p>
                  ) : (
                    <div className="ls-version-list">
                      {layoutVersions.map((v) => {
                        const isLatest = v.version === layoutVersions[0]?.version;
                        return (
                          <div key={v.id} className={`ls-version-row ${isLatest ? 'ls-version-row--current' : ''}`}>
                            <span className="ls-version-badge ls-version-badge--num">v{v.version}</span>
                            <div className="ls-version-info">
                              <span className="ls-version-notes">{v.notes || '—'}</span>
                              <span className="ls-version-meta">
                                {formatSystemDateTimeValue(v.publishedAt, datetimePrefs)}
                                {v.publishedBy ? ` · by ${v.publishedBy.slice(0, 8)}` : ''}
                              </span>
                            </div>
                            {!isLatest && (
                              <button
                                type="button"
                                className="sails-btn sails-btn--ghost sails-btn--sm"
                                disabled={rollbackLoading || isReadOnly}
                                title="Roll back to this version (copies it into the draft)"
                                onClick={() => setRollbackConfirmVersion(v.version)}
                              >
                                <Undo2 size={11} /> Rollback
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="ls-prop-hint">Rollback copies the chosen version into the draft — activate to publish it as the next version.</p>
                </div>
          </div>
              </>
            )}
            {!showProperties && (
              <div className="ls-props-tab" onClick={() => setShowProperties(true)}>
                <Settings size={14} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Floating Overlay for Sort/Filter Editing ── */}
      {listOverlayMode && (
        <div className={`ls-overlay ${listOverlayMode === 'edit-filter' ? 'sails-qstudio-overlay' : ''}`} onClick={closeListOverlay}>
          <div
            className={`ls-overlay-card ${listOverlayMode === 'edit-filter' ? 'sails-qstudio-modal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ls-overlay-card__header">
              <h3 className="ls-overlay-card__title">
                {listOverlayMode === 'edit-sort' ? (
                  <><ArrowUpDown size={14} /> Edit Sort</>
                ) : (
                  <><Filter size={14} /> Edit View Filters</>
                )}
              </h3>
              <button className="ls-block__btn" onClick={closeListOverlay}><X size={14} /></button>
            </div>
            <div className="ls-overlay-card__body">
              {listOverlayMode === 'edit-sort' ? (
                <>
                  {(sortDraft ?? listSortBy).length === 0 && <p className="ls-empty" style={{ padding: 20 }}>No sort rules configured.</p>}
                  {(sortDraft ?? listSortBy).map((rule, idx) => {
                    const sf = allFields.find((f) => f.id === rule.fieldId);
                    return (
                      <div key={idx} className="ls-prop-group" style={idx === 0 ? { borderTop: 'none', paddingTop: 0 } : undefined}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <label className="ls-prop-label" style={{ marginBottom: 0 }}>Rule {idx + 1}</label>
                          <button className="ls-block__btn ls-block__btn--danger" onClick={() => removeSortDraftRule(idx)} title="Remove sort rule"><Trash2 size={12} /></button>
                        </div>
                        <CustomSelect
                          value={rule.fieldId}
                          options={allFields.map((f) => ({ value: f.id, label: f.name }))}
                          onChange={(v) => updateSortDraftRule(idx, { fieldId: String(v) })}
                          size="sm"
                          searchable
                          style={{ marginBottom: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['asc', 'desc'] as const).map((d) => (
                            <button key={d} className={`ls-btn-sort ${rule.direction === d ? 'ls-btn-sort--active' : ''}`}
                              onClick={() => updateSortDraftRule(idx, { direction: d })}>
                              {d === 'asc' ? '\u25B2 ASC' : '\u25BC DESC'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="ls-prop-group" style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <CustomSelect
                      value={sortNewFieldId}
                      options={allFields
                        .filter((f) => !(sortDraft ?? listSortBy).some((r) => r.fieldId === f.id))
                        .map((f) => ({ value: f.id, label: f.name }))}
                      onChange={(v) => setSortNewFieldId(String(v))}
                      size="sm"
                      searchable
                      placeholder="Select field to sort..."
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addSortDraftRule}
                      disabled={!sortNewFieldId || (sortDraft ?? listSortBy).length >= MAX_SORT_RULES}
                      style={{ whiteSpace: 'nowrap' }}><Plus size={12} /> Add</button>
                  </div>
                  <div className="ls-prop-group" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={cancelListSortEditor}>Cancel</button>
                    <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={doneListSortEditor}>Done</button>
                  </div>
                </>
               ) : listOverlayMode === 'edit-filter' && (
                <div style={{ padding: '4px 0 16px' }}>
                  <FilterBuilder
                    fields={allFields}
                    rootTableName={tableMeta?.tableName || ''}
                    initialGroups={filterDraft ?? listFilters}
                    showHeader={false}
                    title="Edit View Filters"
                    onApply={doneListFilterEditor}
                    onCancel={cancelListFilterEditor}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Details Modal ── */}
      {showEditMetaOverlay && (
        <div className="ls-overlay" onClick={() => setShowEditMetaOverlay(false)}>
          <div className="ls-overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="ls-overlay-card__header">
              <h3 className="ls-overlay-card__title">
                <Settings size={14} /> Edit Layout Details
              </h3>
              <button className="ls-block__btn" onClick={() => setShowEditMetaOverlay(false)}><X size={14} /></button>
            </div>
            <div className="ls-overlay-card__body">
              <div className="ls-prop-group" style={{ borderTop: 'none', paddingTop: 0 }}>
                <label className="ls-prop-label">View Name *</label>
                <input className="sails-input" value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 7px' }} />
              </div>
              <div className="ls-prop-group">
                <label className="ls-prop-label">System Name</label>
                <code style={{ fontSize: 11, padding: '5px 7px', display: 'block', background: 'var(--sails-bg-secondary, #f8fafc)', borderRadius: 4, border: '1px solid var(--sails-border, #e2e8f0)', color: 'var(--sails-text-muted, #94a3b8)' }}>{layoutSystemName}</code>
                <span style={{ fontSize: 10, color: 'var(--sails-text-muted, #94a3b8)' }}>System names cannot be changed after creation.</span>
              </div>
              <div className="ls-prop-group">
                <label className="ls-prop-label">Description</label>
                <textarea className="sails-input" value={layoutDescription}
                  onChange={(e) => setLayoutDescription(e.target.value)}
                  rows={3}
                  style={{ fontSize: 12, padding: '5px 7px', resize: 'vertical' }}
                  placeholder="Optional description of this layout" />
              </div>
              <div className="ls-prop-group" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                {layoutIsDefault ? (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--sails-success, #22c55e)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: 'rgba(34, 197, 94, 0.1)',
                  }}>
                    ✓ Default View
                  </span>
                ) : (
                  <button className="sails-btn sails-btn--secondary sails-btn--sm ls-overlay-card__set-default"
                    onClick={() => setShowSetDefaultConfirm(true)}>
                    Set as Default
                  </button>
                )}
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowEditMetaOverlay(false)}>Cancel</button>
                <button className="sails-btn sails-btn--primary sails-btn--sm"
                  onClick={saveListMetadata} disabled={!layoutName.trim() || listSavingMeta}>
                  {listSavingMeta ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Set as Default Confirmation Modal ── */}
      {showSetDefaultConfirm && (
        <div className="ls-modal-overlay" onClick={() => setShowSetDefaultConfirm(false)}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Set as Default View</h3>
            <p className="ls-modal__text">
              Make <strong>{layoutName}</strong> the default LIST view for this model. Any existing default will be replaced.
            </p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowSetDefaultConfirm(false)} disabled={setDefaultLoading}>Cancel</button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={handleSetAsDefault} disabled={setDefaultLoading}>
                {setDefaultLoading ? 'Setting...' : 'Set as Default'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showListDeleteConfirm && (
        <div className="ls-modal-overlay" onClick={() => setShowListDeleteConfirm(false)}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Delete Layout</h3>
            <p className="ls-modal__text">This will permanently delete this layout and all its configuration. This action cannot be undone.</p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowListDeleteConfirm(false)} disabled={listDeleteLoading}>Cancel</button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={deleteListLayout} disabled={listDeleteLoading}>
                {listDeleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="ls-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Reset Layout</h3>
            <p className="ls-modal__text">This will clear all sections, blocks, and tab configurations. This action cannot be undone.</p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={doReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
      {showSaveConfirm && (
        <div className="ls-modal-overlay" onClick={() => { if (!saving) setShowSaveConfirm(false); }}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Save Draft</h3>
            <p className="ls-modal__text">Save the current draft configuration. This will not affect the active layout.</p>
            {saveError && <p className="ls-modal__error">{saveError}</p>}
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowSaveConfirm(false)} disabled={saving}>Cancel</button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={doSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showActivateConfirm && (
        <div className="ls-modal-overlay" onClick={() => { if (!activatingLayout) setShowActivateConfirm(false); }}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Activate Layout</h3>
            <p className="ls-modal__text">This will publish the draft as <strong>version {currentVersion}</strong> and overwrite the currently active layout. Running records keep rendering from the published config — this only updates what new views use.</p>
            <label className="ls-prop-label" style={{ marginBottom: 4 }}>Version Notes</label>
            <input
              className="sails-input"
              value={activateNotes}
              onChange={(e) => setActivateNotes(e.target.value)}
              placeholder="e.g. Added collapsible section + mobile card mode"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowActivateConfirm(false)} disabled={activatingLayout}>Cancel</button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={doActivate} disabled={activatingLayout}>
                {activatingLayout ? 'Activating...' : `Activate v${currentVersion}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDiscardConfirm && (
        <div className="ls-modal-overlay" onClick={() => setShowDiscardConfirm(false)}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Discard Changes</h3>
            <p className="ls-modal__text">This will revert the layout to the currently active version. All unsaved draft changes will be lost. Continue?</p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowDiscardConfirm(false)}>Cancel</button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={doDiscard}>Discard</button>
            </div>
          </div>
        </div>
      )}
      {rollbackConfirmVersion !== null && (
        <div className="ls-modal-overlay" onClick={() => { if (!rollbackLoading) setRollbackConfirmVersion(null); }}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Rollback to version {rollbackConfirmVersion}?</h3>
            <p className="ls-modal__text">
              This copies version {rollbackConfirmVersion}'s configuration into the draft, replacing all current unsaved changes.
              It does <strong>not</strong> publish — activate afterwards to release it as a new version. Running records are never affected.
            </p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setRollbackConfirmVersion(null)} disabled={rollbackLoading}>Cancel</button>
              <button
                className="sails-btn sails-btn--danger sails-btn--sm"
                onClick={() => {
                  const target = rollbackConfirmVersion;
                  setRollbackConfirmVersion(null);
                  doRollback(target);
                }}
                disabled={rollbackLoading}
              >
                {rollbackLoading ? 'Rolling back...' : `Rollback to v${rollbackConfirmVersion}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutStudio;
