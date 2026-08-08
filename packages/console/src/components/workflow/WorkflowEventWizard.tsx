import React, { useState } from 'react';
import { AlertTriangle, AlignLeft, ArrowDown, ArrowRight, ArrowUp, Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, CornerUpLeft, Database, DollarSign, FileText, Filter, Hash, Link2, List, Mail, MapPin, Paperclip, Percent, Phone, Plus, Search, ToggleLeft, Trash2, Type, User, X, type LucideIcon } from 'lucide-react';
import type {
  WorkflowEventType,
  WorkflowEventConfigStep,
  WorkflowEventConfigParameter,
} from '@sails/shared';
import { WORKFLOW_EVENT_CONFIGS, SYSTEM_PROTECTED_COLUMNS } from '@sails/shared';
import { CustomSelect } from '../common/CustomSelect';
import type { SailsTableDefinition } from '@sails/shared';
import { HtmlNotificationEditor } from './HtmlNotificationEditor';
import { VariableTextInput } from './VariableTextInput';
import { WorkflowVariablePicker, buildContextRoot, flattenTree, filterTree, type PickerSchemaMap, type PickerColumn, type TreeNode } from './WorkflowVariablePicker';
import { RecipientsChipsInput } from './RecipientsChipsInput';
import { UiToast } from '../ui';

export interface WizardVariable {
  id: string;
  name: string;
  fieldType: string;
  targetModel?: string;
  schemaMode?: 'model' | 'custom';
  columns?: { fieldName: string; logicalType?: string; label?: string; targetModel?: string }[];
}

/** One field-mapping row (source + target column). `source` defaults to 'variable'. */
export interface MappingEntry {
  source?: 'variable' | 'record' | 'record_old' | 'wf';
  sourceVar?: string;
  sourceField?: string;
  /** Item index into a collection variable (default 0 = first item). */
  itemIndex?: number;
  targetCol: string;
}

export interface WorkflowEventWizardProps {
  eventId: string;
  eventType: WorkflowEventType;
  /** Current event config (seeds the wizard draft). */
  config: Record<string, any>;
  /** Current event label (editable in the Event tab). */
  label: string;
  onLabelChange: (label: string) => void;
  /** Current event description (editable in the Event tab). */
  description: string;
  onDescriptionChange: (description: string) => void;
  variables: WizardVariable[];
  tables: SailsTableDefinition[];
  /** The workflow's root model (the model the triggering record belongs to) — enables 'From Triggering Record' input mapping. Null for manual/scheduled starts. */
  triggerModel?: SailsTableDefinition | null;
  /** The workflow starts on record update (oldValues exist in ctx.record) — shows the OldRecord context branch. */
  hasOldRecord?: boolean;
  /** Model tableName → column schema map (record drill-down in variable pickers). */
  recordSchemas?: PickerSchemaMap;
  /** Triggering record schema (columns) — enables `record.<field>` intellisense. */
  recordSchema?: PickerColumn[];
  /** Create a collection workflow variable for read/list results; returns its id. */
  onCreateCollectionVariable: (name: string, modelTableName: string) => string;
  /** Create a record workflow variable for read results; returns its id. */
  onCreateRecordVariable: (name: string, modelTableName: string) => string;
  onBindVariableToEvent: (varId: string, eventId: string, modelName: string) => void;
  onOpenExpressionEditor: (eventId: string) => void;
  onOpenFilterBuilder: (eventId: string) => void;
  columnsFromModel: (model: any) => { fieldName: string; label: string; logicalType: string }[];
  /**
   * Write-through: every parameter edit lands directly in the live event
   * config (no local draft), so QueryStudio and other consumers always see
   * the current values. The console snapshots config on open and restores it
   * when the wizard is closed without Done.
   */
  onConfigChange: (name: string, value: any) => void;
  /** Done — the config is already committed via onConfigChange; just close. */
  onDone: () => void;
  /** Remove the event entirely (closes the wizard). */
  onRemove: (eventId: string) => void;
  onClose: () => void;
}

const STR = new Set(['short_text', 'long_text', 'rich_text', 'email', 'phone', 'url', 'select', 'user', 'text', 'varchar', 'char', 'relation']);
const NUM = new Set(['number', 'decimal', 'currency', 'percentage', 'auto_number', 'integer', 'numeric']);
const DTM = new Set(['date', 'datetime', 'timestamp', 'time']);

function isCompatibleType(src: string, tgt: string): boolean {
  if (STR.has(src) && STR.has(tgt)) return true;
  if (NUM.has(src) && NUM.has(tgt)) return true;
  if (DTM.has(src) && DTM.has(tgt)) return true;
  if (src === 'boolean' && tgt === 'boolean') return true;
  return false;
}

const OPERATION_LABELS: Record<string, string> = {
  create: 'Create (Insert)', update: 'Update', upsert: 'Upsert (insert or update)',
  delete: 'Delete', read: 'Read (one record)', list: 'List (many records)',
};

/** Human labels for variable fieldTypes and model column logicalTypes. */
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', short_text: 'Short Text', long_text: 'Long Text', rich_text: 'Rich Text',
  email: 'Email', phone: 'Phone', url: 'URL', select: 'Select',
  number: 'Number', decimal: 'Decimal', currency: 'Currency', percentage: 'Percentage', auto_number: 'Auto Number',
  boolean: 'Boolean',
  date: 'Date', datetime: 'Date & Time', time: 'Time',
  user: 'User', relation: 'Relation', address: 'Address', lat_lng: 'Lat / Lng', attachment: 'Attachment',
  record: 'Record', collection: 'Collection',
};

function isEmptyValue(v: any): boolean {
  return v === undefined || v === null || (typeof v === 'string' && !v.trim());
}

/**
 * Platform-standard Workflow Event configuration — TABBED interface.
 * Tab 1 is always "Event" (name + description); each further tab renders one
 * schema step from WORKFLOW_EVENT_CONFIGS. Done validates completion and
 * blocks with inline errors + red dots on offending tabs.
 */
export const WorkflowEventWizard: React.FC<WorkflowEventWizardProps> = ({
  eventId, eventType, config, label, onLabelChange, description, onDescriptionChange,
  variables, tables, triggerModel, hasOldRecord, recordSchemas, recordSchema,
  onCreateCollectionVariable, onCreateRecordVariable, onBindVariableToEvent,
  onOpenExpressionEditor, onOpenFilterBuilder, columnsFromModel,
  onConfigChange, onDone, onRemove, onClose,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [dropFeedback, setDropFeedback] = useState<{ col: string; ok: boolean } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ srcIndex: number; tgtIndex: number; ok: boolean; cx: number; cy: number } | null>(null);
  const [colSort, setColSort] = useState<'asc' | 'desc' | null>(null);
  const [colSearch, setColSearch] = useState('');
  const [selMapIdx, setSelMapIdx] = useState<number | null>(null);
  const [srcExpanded, setSrcExpanded] = useState<Set<string>>(() => new Set());
  const [srcSearch, setSrcSearch] = useState('');
  const [srcIndex, setSrcIndex] = useState<Record<string, string>>({});
  // Click-to-assign: the active source leaf (click a leaf, then a column).
  const [clickSrc, setClickSrc] = useState<{ source?: 'variable' | 'record' | 'record_old' | 'wf'; sourceVar?: string; sourceField?: string; itemIndex?: number; fieldType?: string; name?: string } | null>(null);
  // Independent rail scroll offsets (lines overlay is scroll-independent).
  const [leftScroll, setLeftScroll] = useState(0);
  const [rightScroll, setRightScroll] = useState(0);
  const mapRowRef = React.useRef<HTMLDivElement | null>(null);
  const leftRowsRef = React.useRef<HTMLDivElement | null>(null);
  const rightRowsRef = React.useRef<HTMLDivElement | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [mapToast, setMapToast] = useState<string | null>(null);
  const mapToastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyMapping = (msg: string | null) => {
    if (mapToastTimer.current) clearTimeout(mapToastTimer.current);
    setMapToast(msg);
    if (msg) {
      mapToastTimer.current = setTimeout(() => {
        setMapToast(null);
        setDropFeedback(null);
      }, 3200);
    }
  };
  React.useEffect(() => () => { if (mapToastTimer.current) clearTimeout(mapToastTimer.current); }, []);

  // Delete/Backspace removes the selected connection line; Escape clears the
  // click-to-assign source (never while typing).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (typing) return;
        setClickSrc(null);
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (typing) return;
      if (selMapIdx === null) return;
      e.preventDefault();
      const fm = config.fieldMapping || [];
      if (fm[selMapIdx]) onConfigChange('fieldMapping', fm.filter((_: any, j: number) => j !== selMapIdx));
      setSelMapIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selMapIdx, config, onConfigChange]);

  // The event config is LIVE (write-through) — no local draft. `config` is
  // refreshed by the parent on every onConfigChange.
  const fieldMapping: MappingEntry[] = config.fieldMapping || [];

  const schema = WORKFLOW_EVENT_CONFIGS[eventType] || [];
  const op = String(config.operation || 'read');

  // System columns are engine-managed — never mappable for create/update/upsert
  // (runtime strips them via stripProtectedColumns anyway). Exception: `id`
  // stays mappable for upsert, where a mapped id is the ON CONFLICT key.
  const isMappableTarget = (name: string): boolean => {
    if (op !== 'create' && op !== 'update' && op !== 'upsert') return true;
    if (op === 'upsert' && name === 'id') return true;
    return !SYSTEM_PROTECTED_COLUMNS.includes(name);
  };

  // Prune stale mappings onto system columns (older configs, op switches).
  React.useEffect(() => {
    const fm: MappingEntry[] = config.fieldMapping || [];
    const kept = fm.filter((m) => isMappableTarget(m.targetCol));
    if (kept.length !== fm.length) onConfigChange('fieldMapping', kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op, config.model]);
  const isReadList = op === 'read' || op === 'list';
  const isTargetable = eventType === 'record' && (op === 'read' || op === 'update' || op === 'upsert' || op === 'delete');
  // Visible steps per operation: read/list have no Input; delete has no Output.
  const steps = isReadList
    ? schema.filter((s) => s.label !== 'Input')
    : op === 'delete'
      ? schema.filter((s) => s.label !== 'Output')
      : schema;
  const tabs = [{ label: 'Event' }, ...steps.map((s) => ({ label: s.label }))];
  const currentTab = Math.min(activeTab, tabs.length - 1);
  const isLastTab = currentTab === tabs.length - 1;
  const modelTable = tables.find((t) => t.tableName === config.model);
  // A model only counts when it actually exists — a stale saved value (e.g.
  // the legacy 'Contracts' default) must not unlock the operation controls.
  const hasValidModel = !!modelTable;
  const modelFields: any[] = modelTable?.fields || [];
  const stepIndex = currentTab - 1;
  const activeStep = stepIndex >= 0 ? steps[stepIndex] : null;
  const stepParams: WorkflowEventConfigParameter[] = activeStep?.parameters || [];

  /** The workflow root model's fields in picker shape (record/oldRecord branches). */
  const triggerModelFields = (): PickerColumn[] | undefined =>
    triggerModel?.fields
      ? (triggerModel.fields as any[]).map((f: any) => ({
          fieldName: f.fieldName || f.name, label: f.name || f.fieldName,
          logicalType: f.logicalType || f.physicalType || 'text',
        }))
      : undefined;

  const setParam = (name: string, value: any) => {
    onConfigChange(name, value);
    // Dependent state resets when the model/operation changes.
    if (name === 'model' || name === 'operation') {
      onConfigChange('filterGroups', []);
      onConfigChange('fieldMapping', []);
    }
  };

  /** Result-variable structure vs the target model (matches runtime validation). */
  const variableStructureIssue = (): string | null => {
    if (op === 'delete') return null; // no Output step for delete
    const varName = String(config.storeToVariable || '').trim();
    if (!varName || !hasValidModel) return null;
    const def = variables.find((v) => v.name === varName);
    if (!def) return null; // unknown var — runtime skips validation too
    if (def.targetModel && def.targetModel !== config.model) {
      return `Variable '${varName}' was created from model '${def.targetModel}' — structure won't match '${config.model}'.`;
    }
    const declared = def.columns || [];
    if (declared.length === 0) return null; // no declared structure — nothing to compare
    const missing: string[] = [];
    for (const c of declared) {
      if (!c.fieldName) continue;
      const field = modelFields.find((f: any) => (f.fieldName || f.name) === c.fieldName);
      if (!field || !isCompatibleType(c.logicalType || 'text', field.logicalType || field.physicalType || 'text')) {
        missing.push(c.fieldName);
      }
    }
    if (missing.length > 0) {
      return `Variable '${varName}' needs column${missing.length > 1 ? 's' : ''} ${missing.map((m) => `'${m}'`).join(', ')} which '${config.model}' doesn't match — the event would fail at runtime.`;
    }
    return null;
  };

  /** Completion check — returns per-tab issues (tab 0 = Event tab). */
  const validateConfig = (): { tab: number; message: string }[] => {
    const issues: { tab: number; message: string }[] = [];
    if (!label.trim()) issues.push({ tab: 0, message: 'Event name is required.' });
    steps.forEach((step, i) => {
      for (const p of step.parameters) {
        if (!p.required) continue;
        if (isEmptyValue(config[p.name])) {
          issues.push({ tab: i + 1, message: `${p.label} is required.` });
        }
      }
    });
    if (isTargetable) {
      const targetType = String(config.targetType || 'trigger');
      if (targetType !== 'trigger' && isEmptyValue(config.targetValue)) {
        const tab = steps.findIndex((s) => s.parameters.some((p) => p.name === 'targetValue')) + 1;
        issues.push({ tab: Math.max(tab, 1), message: 'Target value is required when not using the triggering record.' });
      }
    }
    const mismatch = variableStructureIssue();
    if (mismatch) {
      const outTab = steps.findIndex((s) => s.parameters.some((p) => p.name === 'storeToVariable'));
      issues.push({ tab: Math.max(outTab + 1, 1), message: mismatch });
    }
    return issues;
  };

  const issues = validateConfig();
  const issueForTab = (tab: number) => issues.filter((i) => i.tab === tab);

  const finish = () => {
    const found = validateConfig();
    if (found.length > 0) {
      setErrorBanner(found[0].message);
      setActiveTab(found[0].tab);
      return;
    }
    setErrorBanner(null);
    // Auto-create the result variable (read/write → record, list → collection)
    // unless an existing one was picked. Both creators de-duplicate by name,
    // so an existing selection just gets bound.
    if (eventType === 'record' && op !== 'delete' && config.model) {
      const name = config.storeToVariable || `${op}_${config.model}`;
      if (!config.storeToVariable) onConfigChange('storeToVariable', name);
      const varId = op === 'list'
        ? onCreateCollectionVariable(name, config.model)
        : onCreateRecordVariable(name, config.model);
      if (varId) onBindVariableToEvent(varId, eventId, config.model);
    }
    onDone();
  };

  const renderParam = (p: WorkflowEventConfigParameter) => {
    const value = config[p.name];
    switch (p.type) {
      case 'model_select':
        return (
          <CustomSelect
            size="md" searchable
            value={value || ''}
            options={tables.map((t) => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
            onChange={(v) => setParam(p.name, String(v))}
            placeholder="Select target model..."
          />
        );
      case 'operation_select':
        return (
          <CustomSelect
            size="md"
            value={value || 'read'}
            options={Object.entries(OPERATION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => setParam(p.name, String(v))}
            placeholder="Select operation..."
            disabled={!hasValidModel}
          />
        );
      case 'filter_builder': {
        const n = (config.filterGroups || []).reduce((acc: number, g: any) => acc + (g.rules?.length || 0), 0);
        return (
          <button type="button" className="ws-props-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: hasValidModel ? 'pointer' : 'not-allowed', opacity: hasValidModel ? 1 : 0.55 }}
            disabled={!hasValidModel}
            onClick={() => hasValidModel && onOpenFilterBuilder(eventId)}>
            <Filter size={12} /> {n > 0 ? `${n} rule${n > 1 ? 's' : ''}` : 'Build filters…'}
          </button>
        );
      }
      case 'variable_auto_create': {
        // Output result variable for every operation except delete (its step
        // is hidden). list → collection; read and all writes → record.
        const isListOp = op === 'list';
        const pickerVars = variables.filter((v) => v.name && (isListOp ? v.fieldType === 'collection' : v.fieldType === 'record'));
        const toName = (ref: string) => String(ref || '').replace(/[{}]/g, '').split('.')[0].trim();
        const mismatch = variableStructureIssue();
        return (
          <>
            <WorkflowVariablePicker
              variables={pickerVars}
              topLevelOnly
              value={config.storeToVariable || ''}
              onChange={(ref) => { const name = toName(ref); onConfigChange('storeToVariable', name); }}
              placeholder={isListOp ? 'Select a collection variable…' : 'Select a record variable…'}
            />
            {mismatch && (
              <p className="ws-props-hint" style={{ padding: '2px 0 0', color: '#ef4444' }}>{mismatch}</p>
            )}
            {!config.model && (
              <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>Select a model in the Action tab first.</p>
            )}
            {config.model && modelFields.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--sails-text-secondary)', maxHeight: 120, overflow: 'auto', border: '1px solid var(--sails-border)', borderRadius: 4, padding: 6, background: 'var(--sails-bg-secondary)' }}>
                {modelFields.map((f: any) => (
                  <span key={f.fieldName || f.name} style={{ display: 'inline-block', margin: '1px 4px' }}>
                    {f.name || f.fieldName}<code style={{ fontSize: 9, marginLeft: 3 }}>{f.logicalType || f.physicalType}</code>
                  </span>
                ))}
              </div>
            )}
          </>
        );
      }
      case 'field_mapping': {
        // read/list never write — their Input step is hidden.
        if (isReadList || op === 'delete') return null;
        const ROW_H = 34;
        const LABEL_H = 26;
        const SEARCH_H = 30;
        const ROW_GAP = 4;
        const ROW_PITCH = ROW_H + ROW_GAP;
        const ROWS_MAX = 300;
        // Compact section headers — they use their own (smaller) pitch.
        const SECTION_H = 22;
        const SECTION_GAP = 4;
        const SECTION_PITCH = SECTION_H + SECTION_GAP;
        const PORT_R = 6;
        const HEADER_H = LABEL_H + SEARCH_H;
        // 40% left · 20% drag gap · 40% right — measured from the flex row so
        // the overlay lines and ports stay in lockstep.
        const mapW = mapRowRef.current?.offsetWidth || 0;
        const svgLeft = mapW ? mapW * 0.4 : 280;
        const GAP_W = mapW ? Math.round(mapW * 0.2) : 160;
        const isMappableCol = (col: any): boolean => isMappableTarget(col.fieldName || col.name);
        // The unified Workflow Context tree: Requestor / Request Date / Record /
        // OldRecord (when the workflow can supply old values) + Variables + Collections.
        const srcTreeAll = buildContextRoot({
          variables,
          triggerModelFields: triggerModelFields(),
          triggerModelName: triggerModel?.tableName,
          includeOldRecord: !!hasOldRecord,
          includeRequestor: true,
        });
        const searching = srcSearch.trim().length > 0;
        const srcTree = searching ? filterTree(srcTreeAll, srcSearch) : srcTreeAll;
        // Sections + record branches default open; [N] indices stay closed.
        // While searching, everything expands so matches are visible.
        const DEFAULT_EXPANDED = new Set(['sec:wf', 'sec:vars', 'sec:collections', 'wf:requestor', 'rec:root', 'old:root']);
        const expandedSet = searching
          ? (() => {
              const s = new Set<string>();
              const collect = (nodes: TreeNode[]) => { for (const n of nodes) { if (n.children?.length) { s.add(n.key); collect(n.children); } } };
              collect(srcTree);
              return s;
            })()
          : new Set([...DEFAULT_EXPANDED, ...srcExpanded]);
        const srcRows = flattenTree(srcTree, expandedSet);
        const entryMatches = (node: TreeNode, m: MappingEntry): boolean => {
          const src = m.source || 'variable';
          if (node.source !== src) return false;
          if (src === 'variable') {
            if (node.varName !== m.sourceVar) return false;
            return !m.sourceField || node.fieldName === m.sourceField;
          }
          return node.fieldName === m.sourceField;
        };
        const toggleSrc = (key: string) => {
          if (DEFAULT_EXPANDED.has(key)) return;
          setSrcExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });
        };

        // Chip tint + icon per field type (mirrors the event-chip styling).
        const TYPE_COLOR: Record<string, string> = {
          short_text: '#64748b', long_text: '#64748b', rich_text: '#64748b', email: '#64748b', phone: '#64748b', url: '#64748b', select: '#64748b',
          number: '#3b82f6', decimal: '#3b82f6', currency: '#3b82f6', percentage: '#3b82f6', auto_number: '#3b82f6',
          boolean: '#10b981',
          date: '#f59e0b', datetime: '#f59e0b', time: '#f59e0b',
          user: '#8b5cf6', relation: '#8b5cf6',
        };
        const TYPE_ICONS: Record<string, LucideIcon> = {
          short_text: Type, long_text: AlignLeft, rich_text: FileText, email: Mail, phone: Phone, url: Link2, select: List,
          number: Hash, decimal: Hash, currency: DollarSign, percentage: Percent, auto_number: Hash,
          boolean: ToggleLeft,
          date: Calendar, datetime: Calendar, time: Clock,
          user: User, relation: Link2, address: MapPin, lat_lng: MapPin, attachment: Paperclip,
        };
        const typeColor = (t: string) => TYPE_COLOR[t] || '#64748b';
        const typeIcon = (t: string) => TYPE_ICONS[t] || Type;
        // Human label for the type badge (mirrors the Workflow Properties Variables list).
        const typeLabel = (t: string) => FIELD_TYPE_LABELS[t] || t;

        const sortRows = (rows: any[], dir: 'asc' | 'desc' | null) => {
          if (!dir) return rows;
          const sorted = [...rows].sort((a, b) =>
            String(a.name || a.fieldName || '').localeCompare(String(b.name || b.fieldName || ''))
          );
          return dir === 'desc' ? sorted.reverse() : sorted;
        };
        const cycleSort = (cur: 'asc' | 'desc' | null): 'asc' | 'desc' | null =>
          cur === 'asc' ? 'desc' : cur === 'desc' ? null : 'asc';

        const displayColsAll = sortRows(modelFields.filter(isMappableCol), colSort);
        const colSearching = colSearch.trim().length > 0;
        const displayCols = colSearching
          ? displayColsAll.filter((c: any) => String(c.name || c.fieldName || '').toLowerCase().includes(colSearch.toLowerCase()))
          : displayColsAll;

        /** Same source descriptor (unmap-on-reapply); different source replaces. */
        const sameSource = (a: MappingEntry, b: { source?: 'variable' | 'record' | 'record_old' | 'wf'; sourceVar?: string; sourceField?: string; itemIndex?: number }) =>
          (a.source || 'variable') === (b.source || 'variable')
          && a.sourceVar === b.sourceVar
          && a.sourceField === b.sourceField
          && (a.itemIndex ?? 0) === (b.itemIndex ?? 0);

        /** Shared map/replace/unmap for drag-drops and click-to-assign. */
        const tryMap = (desc: { source?: 'variable' | 'record' | 'record_old' | 'wf'; sourceVar?: string; sourceField?: string; itemIndex?: number; fieldType?: string; name?: string }, col: any) => {
          if (!isMappableCol(col)) return;
          const colType = col.logicalType || col.physicalType || 'text';
          const compat = isCompatibleType(desc.fieldType || '', colType);
          setDropFeedback({ col: col.fieldName || col.name, ok: compat });
          if (compat) {
            notifyMapping(null);
            const targetCol = col.fieldName || col.name;
            const existing = fieldMapping.find((m) => m.targetCol === targetCol);
            const entry: MappingEntry = { source: desc.source || 'variable', sourceVar: desc.sourceVar, sourceField: desc.sourceField, itemIndex: desc.itemIndex, targetCol };
            if (!existing) {
              onConfigChange('fieldMapping', [...fieldMapping, entry]);
            } else if (sameSource(existing, desc)) {
              // Re-applying the same source → unmap (drop-toggle behavior).
              onConfigChange('fieldMapping', fieldMapping.filter((m) => m.targetCol !== targetCol));
            } else {
              // A different source → replace the existing mapping.
              onConfigChange('fieldMapping', fieldMapping.map((m) => (m.targetCol === targetCol ? entry : m)));
            }
          } else {
            notifyMapping(`Can't map '${desc.name || desc.sourceVar || desc.sourceField}' (${typeLabel(desc.fieldType || '')}) → ${col.name || col.fieldName} (${typeLabel(colType)}) — field types are not compatible.`);
          }
        };

        const handlePortDrop = (e: React.DragEvent, col: any) => {
          e.preventDefault(); e.stopPropagation();
          setDragPreview(null);
          try {
            const p = JSON.parse(e.dataTransfer.getData('application/json'));
            if (p.type !== 'wiz-map') return;
            tryMap(p, col);
          } catch { /* ignore */ }
        };

        /** Auto-map tree leaves to columns by normalized name (skip already-mapped columns). */
        const autoMap = () => {
          const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const next = [...fieldMapping];
          const skipped: string[] = [];
          const leaves = srcRows.filter((r) => r.node.kind === 'leaf');
          for (const { node: v } of leaves) {
            const name = v.label || v.fieldName || v.varName || '';
            const col = displayCols.find((c: any) => {
              const cn = norm(c.fieldName || c.name);
              return cn === norm(name) && !next.some((m) => m.targetCol === (c.fieldName || c.name));
            });
            if (!col) continue; // no matching column, or already mapped
            if (isCompatibleType(v.logicalType || 'text', col.logicalType || col.physicalType || 'text')) {
              next.push({ source: v.source, sourceVar: v.varName, sourceField: v.fieldName, targetCol: col.fieldName || col.name });
            } else {
              skipped.push(name);
            }
          }
          const added = next.length - fieldMapping.length;
          onConfigChange('fieldMapping', next);
          if (leaves.length === 0) {
            notifyMapping(null);
          } else if (added === 0 && skipped.length === 0) {
            notifyMapping('Auto Map: no matching columns found for any source.');
          } else if (skipped.length > 0) {
            notifyMapping(`Auto Map: ${added > 0 ? `${added} mapped · ` : ''}skipped ${skipped.join(', ')} (type mismatch).`);
          } else {
            notifyMapping(null);
          }
        };

        if (!config.model) {
          return <p className="ws-props-hint">Select a model in the Action tab first.</p>;
        }

        // Row geometry (rows-area coordinates — the connector layer sits under
        // the label/search band and never scrolls, so each rail's scrollTop is
        // subtracted from its rows' content Y).
        // LEFT rows are pitched per-kind (compact SECTION_PITCH for section
        // headers, ROW_PITCH otherwise); the RIGHT (columns) rail is flat.
        const yAtSrc = (rowIndex: number) => {
          let y = ROW_H / 2 - leftScroll;
          for (let k = 0; k < rowIndex; k++) {
            y += srcRows[k].node.kind === 'section' ? SECTION_PITCH : ROW_PITCH;
          }
          return y;
        };
        const yAtCol = (colIndex: number) => colIndex * ROW_PITCH + ROW_H / 2 - rightScroll;
        const connPath = (x1: number, y1: number, x2: number, y2: number) =>
          `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.35} ${y1}, ${x1 + (x2 - x1) * 0.65} ${y2}, ${x2} ${y2}`;

        const portStyle: React.CSSProperties = {
          position: 'absolute', width: PORT_R * 2, height: PORT_R * 2, borderRadius: '50%',
          background: 'var(--sails-primary,#9dcee0)', border: '2px solid var(--sails-bg-card)',
          boxShadow: '0 0 0 1px rgba(157,206,224,.5)', cursor: 'crosshair', zIndex: 3,
        };

        return (
          <>
            {/* Toolbar */}
            <div className="ws-props-row" style={{ gap: 8, marginBottom: 8 }}>
              <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={autoMap} title="Map variables to columns with the same name (compatible types only)">
                <Plus size={12} /> Auto Map by Name
              </button>
              <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => onConfigChange('fieldMapping', [])} disabled={fieldMapping.length === 0} title="Clear all mappings">
                <Trash2 size={12} /> Clear All
              </button>
              <span className="ws-props-hint" style={{ padding: 0 }}>{fieldMapping.length} mapped</span>
              {selMapIdx !== null && fieldMapping[selMapIdx] && (
                <span className="ws-props-hint" style={{ padding: 0, color: '#ef4444' }}>
                  Line selected — press Delete/Backspace to remove
                </span>
              )}
              {clickSrc && (
                <span className="ws-props-hint" style={{ padding: 0, color: 'var(--sails-primary,#9dcee0)' }}>
                  Source '{clickSrc.name || clickSrc.sourceVar || clickSrc.sourceField}' — click a column to map (Esc to cancel)
                </span>
              )}
            </div>

            <div
              style={{ position: 'relative', padding: 4 }}
              onClick={() => { setSelMapIdx(null); setClickSrc(null); }}
            >
              <div
                ref={mapRowRef}
                style={{ display: 'flex', position: 'relative' }}
                onDragOver={(e) => {
                  // Live connector follows the cursor in rows-area coords
                  // (the layer sits below the header band and never scrolls).
                  const rect = e.currentTarget.getBoundingClientRect();
                  const cursorX = e.clientX - rect.left;
                  const cursorY = e.clientY - rect.top - HEADER_H;
                  setDragPreview((prev) => (prev ? { ...prev, cx: cursorX, cy: cursorY } : prev));
                  // Edge auto-scroll: near a rail's top/bottom edge → scroll it.
                  const rail = cursorX < rect.width * 0.4 ? leftRowsRef : (cursorX > rect.width * 0.6 ? rightRowsRef : null);
                  if (rail?.current) {
                    const el = rail.current;
                    const edge = 48;
                    if (cursorY < edge && el.scrollTop > 0) el.scrollTop = Math.max(0, el.scrollTop - 16);
                    else if (cursorY > el.clientHeight - edge && el.scrollTop < el.scrollHeight - el.clientHeight) {
                      el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + 16);
                    }
                  }
                }}
              >
                {/* Left — input sources (independent scroll; ports on leaves).
                    Wider than its content by the 20px scrollbar gutter, so the
                    auto scrollbar never covers the port dots. */}
                <div style={{ flex: '0 0 calc(40% + 20px)', minWidth: 0 }}>
                  <div style={{ height: LABEL_H, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <label className="ws-props-label" style={{ margin: 0 }}>Input</label>
                  </div>
                  <div className="wvp-search" style={{ boxSizing: 'border-box', height: SEARCH_H, marginBottom: 0 }}>
                    <Search size={11} />
                    <input
                      className="wvp-search-input"
                      placeholder="Search inputs…"
                      value={srcSearch}
                      onChange={(e) => setSrcSearch(e.target.value)}
                    />
                  </div>
                  <div
                    ref={leftRowsRef}
                    style={{ maxHeight: ROWS_MAX, overflowY: 'auto', overflowX: 'hidden', paddingRight: 20 }}
                    onScroll={(e) => setLeftScroll(e.currentTarget.scrollTop)}
                  >
                    {srcRows.map(({ node: v, depth }, i) => {
                      const isSection = v.kind === 'section';
                      const isLeaf = v.kind === 'leaf';
                      const hasChildren = !!v.children && v.children.length > 0;
                      const open = expandedSet.has(v.key);
                      const lt = isSection ? 'text' : v.logicalType || 'text';
                      const isClickSrcLeaf = !!clickSrc && clickSrc.source === v.source && clickSrc.sourceVar === v.varName && clickSrc.sourceField === v.fieldName;
                      return (
                        <div
                          key={v.key}
                          className={`wvp-node ${isSection ? 'wvp-node--section' : ''} ${isClickSrcLeaf ? 'wvp-node--selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLeaf) {
                              const itemIndex = v.itemKey
                                ? (parseInt(srcIndex[v.itemKey] || '0', 10) || 0)
                                : undefined;
                              setClickSrc({ source: v.source, sourceVar: v.varName, sourceField: v.fieldName, itemIndex, fieldType: lt, name: v.label });
                              setSelMapIdx(null);
                            } else if (hasChildren) {
                              toggleSrc(v.key);
                            }
                          }}
                          draggable={isLeaf}
                          onDragStart={isLeaf ? (e) => {
                            e.stopPropagation();
                            const itemIndex = v.itemKey
                              ? (parseInt(srcIndex[v.itemKey] || '0', 10) || 0)
                              : undefined;
                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'wiz-map', source: v.source, sourceVar: v.varName, sourceField: v.fieldName, itemIndex, name: v.label, fieldType: lt, rowIndex: i }));
                            e.dataTransfer.effectAllowed = 'copy';
                            setDragPreview({ srcIndex: i, tgtIndex: -1, ok: false, cx: svgLeft, cy: yAtSrc(i) });
                          } : undefined}
                          onDragEnd={() => setDragPreview(null)}
                          title={isSection ? v.label : isLeaf ? `Type: ${typeLabel(lt)} — drag to a column port, or click then a column` : v.label}
                          style={{
                            position: 'relative', marginTop: 0, boxSizing: 'border-box', width: '100%',
                            height: isSection ? SECTION_H : ROW_H,
                            marginBottom: isSection ? SECTION_GAP : ROW_GAP,
                            paddingLeft: isSection ? 6 : 6 + depth * 12, gap: 4,
                          }}
                        >
                          <span className="wvp-node__chevron" onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleSrc(v.key); }}>
                            {hasChildren ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <span style={{ width: 11 }} />}
                          </span>
                          <span className="wvp-node__icon" style={{ color: typeColor(lt) }}>
                            {(() => { const I = typeIcon(lt); return <I size={11} />; })()}
                          </span>
                          {v.kind === 'index' ? (
                            <span className="wvp-node__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <code style={{ color: 'var(--sails-text-muted,#94a3b8)' }}>[</code>
                              <input
                                className="wvp-node__index"
                                style={{ width: 28 }}
                                value={srcIndex[v.indexKey || v.key] ?? ''}
                                placeholder="N"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSrcIndex((m) => ({ ...m, [v.indexKey || v.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                              />
                              <code style={{ color: 'var(--sails-text-muted,#94a3b8)' }}>]</code>
                            </span>
                          ) : (
                            <span className="wvp-node__label" style={isSection ? undefined : { color: typeColor(lt) }}>{v.label}</span>
                          )}
                          {!isSection && v.kind !== 'index' && <span className="wvp-node__type">{typeLabel(lt)}</span>}
                          {isLeaf && (
                            /* Visual port marker — the whole row is draggable */
                            <span className="ws-map-port" style={{ ...portStyle, right: 2, top: '50%', transform: 'translateY(-50%)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Middle — drag & drop gap (20% − scrollbar gutter) */}
                <div style={{ flex: '0 0 calc(20% - 20px)' }} />

                {/* Right — Columns (independent scroll; ports on the left edge) */}
                <div style={{ flex: '0 0 40%', minWidth: 0 }}>
                  <div style={{ height: LABEL_H, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <label className="ws-props-label" style={{ margin: 0 }}>Columns ({modelTable?.name || ''})</label>
                    <button type="button" className="ws-icon-btn" title={colSort === 'asc' ? 'Sorting A→Z — click for Z→A' : colSort === 'desc' ? 'Sorting Z→A — click to reset' : 'Click to sort A→Z'} onClick={() => setColSort(cycleSort(colSort))}>
                      {colSort === 'asc' ? <ArrowUp size={11} /> : colSort === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} style={{ opacity: 0.4 }} />}
                    </button>
                  </div>
                  <div className="wvp-search" style={{ boxSizing: 'border-box', height: SEARCH_H, marginBottom: 0 }}>
                    <Search size={11} />
                    <input
                      className="wvp-search-input"
                      placeholder="Search columns…"
                      value={colSearch}
                      onChange={(e) => setColSearch(e.target.value)}
                    />
                  </div>
                  <div
                    ref={rightRowsRef}
                    style={{ maxHeight: ROWS_MAX, overflowY: 'auto', overflowX: 'hidden' }}
                    onScroll={(e) => setRightScroll(e.currentTarget.scrollTop)}
                  >
                    {displayCols.map((col: any, ci: number) => {
                      const mapped = fieldMapping.some((m) => m.targetCol === (col.fieldName || col.name));
                      const feedback = dropFeedback !== null && dropFeedback.col === (col.fieldName || col.name);
                      const feedbackOk = feedback && dropFeedback.ok;
                      const colType = col.logicalType || col.physicalType || 'text';
                      return (
                        <div key={col.fieldName || col.name} className="wvp-node"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (clickSrc) tryMap(clickSrc, col);
                            else if (mapped) onConfigChange('fieldMapping', fieldMapping.filter((m) => m.targetCol !== (col.fieldName || col.name)));
                          }}
                          style={{
                            position: 'relative', height: ROW_H, marginTop: 0, marginBottom: ROW_GAP, boxSizing: 'border-box', width: '100%', gap: 4,
                            background: mapped ? 'rgba(59,130,246,.08)' : (feedback ? (feedbackOk ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)') : undefined),
                            borderRadius: 4,
                          }}
                        >
                          {/* Left port — drop target */}
                          <span
                            className="ws-map-port"
                            style={{ ...portStyle, left: 2, top: '50%', transform: 'translateY(-50%)' }}
                            title={mapped ? 'Drop to unmap' : `Drop to map a variable → ${col.name || col.fieldName}`}
                            onDragOver={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              e.dataTransfer.dropEffect = 'copy';
                              const ok = isCompatibleType(
                                (() => { try { return JSON.parse(e.dataTransfer.getData('application/json')).fieldType || ''; } catch { return ''; } })(),
                                colType,
                              );
                              setDragPreview((prev) => (prev ? { ...prev, tgtIndex: ci, ok } : prev));
                            }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragPreview((prev) => (prev ? { ...prev, tgtIndex: -1 } : prev)); }}
                            onDrop={(e) => handlePortDrop(e, col)}
                          />
                          <span className="wvp-node__icon" style={{ color: typeColor(colType) }}>
                            {(() => { const I = typeIcon(colType); return <I size={11} />; })()}
                          </span>
                          <span className="wvp-node__label">{col.name || col.fieldName}</span>
                          <span className="wvp-node__type">{typeLabel(colType)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Connector layer — confined to the rows band (below the label
                    + search rows) and clipped, so lines can never fly over the
                    header or off the panel when the rails scroll. */}
                <svg style={{ position: 'absolute', left: 0, top: HEADER_H, width: '100%', height: `calc(100% - ${HEADER_H}px)`, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                  {fieldMapping.map((m, mi) => {
                    const si = srcRows.findIndex((r) => entryMatches(r.node, m));
                    const ti = displayCols.findIndex((c: any) => (c.fieldName || c.name) === m.targetCol);
                    if (si < 0 || ti < 0) return null;
                    const sel = selMapIdx === mi;
                    const srcLabel = `${m.sourceVar || m.sourceField || '?'}${m.itemIndex != null ? `[${m.itemIndex}]` : ''}`;
                    return (
                      <g key={mi}>
                        <title>{sel ? `${srcLabel} → ${m.targetCol} (click again or press Delete to remove)` : `${srcLabel} → ${m.targetCol} (click to select)`}</title>
                        <path
                          d={connPath(svgLeft, yAtSrc(si), svgLeft + GAP_W, yAtCol(ti))}
                          stroke={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'}
                          strokeWidth={sel ? 3 : 2}
                          fill="none"
                          strokeLinecap="round"
                          style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); setSelMapIdx(sel ? null : mi); }}
                        />
                        <circle cx={svgLeft + GAP_W} cy={yAtCol(ti)} r={sel ? 4.5 : 3.5} fill={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'} style={{ pointerEvents: 'visiblePainted' }} onClick={(e) => { e.stopPropagation(); setSelMapIdx(sel ? null : mi); }} />
                      </g>
                    );
                  })}
                  {dragPreview && (
                    <path
                      d={
                        dragPreview.tgtIndex >= 0
                          ? connPath(svgLeft, yAtSrc(dragPreview.srcIndex), svgLeft + GAP_W, yAtCol(dragPreview.tgtIndex))
                          : connPath(svgLeft, yAtSrc(dragPreview.srcIndex), Math.min(Math.max(dragPreview.cx, svgLeft), svgLeft + GAP_W), dragPreview.cy)
                      }
                      stroke={dragPreview.tgtIndex >= 0 ? (dragPreview.ok ? '#10b981' : '#ef4444') : 'var(--sails-primary,#9dcee0)'}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      fill="none"
                      strokeLinecap="round"
                      opacity={0.9}
                    />
                  )}
                </svg>
              </div>
            </div>
          </>
        );
      }

      case 'target_record':
        return (
          <select className="ws-props-input" value={value || 'trigger'} onChange={(e) => setParam(p.name, e.target.value)}>
            {(p.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'variable_select':
        // Context-aware: when the sibling `targetType` is 'variable', offer a
        // dropdown of workflow variables; otherwise (literal id) a text input.
        if (config.targetType === 'variable') {
          return (
            <select className="ws-props-input" value={value || ''} onChange={(e) => setParam(p.name, e.target.value)}>
              <option value="">Select…</option>
              {variables.filter((v) => v.name && v.fieldType !== 'collection').map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          );
        }
        return <input className="ws-props-input" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} />;
      case 'expression_editor':
        return (
          <button className="ws-props-input" style={{ display: 'block', textAlign: 'left', cursor: 'pointer', color: 'var(--sails-primary)' }}
            onClick={() => onOpenExpressionEditor(eventId)}>
            {value ? <code style={{ fontSize: 11 }}>{value}</code> : <em style={{ color: 'var(--sails-text-muted)' }}>Click to edit expression...</em>}
          </button>
        );
      case 'select':
        return (
          <select className="ws-props-input" value={value ?? p.defaultValue ?? ''} onChange={(e) => setParam(p.name, e.target.value)}>
            {(p.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'boolean':
        return (
          <label className="ws-props-check" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!(value ?? p.defaultValue)} onChange={(e) => setParam(p.name, e.target.checked)} /> {p.label}
          </label>
        );
      case 'number':
        return <input className="ws-props-input" type="number" value={value ?? p.defaultValue ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value ? Number(e.target.value) : null)} />;
      case 'textarea':
        return <textarea className="ws-props-input ws-props-textarea" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} rows={3} />;
      case 'html_editor':
        return (
          <HtmlNotificationEditor
            value={value ?? ''}
            variables={variables}
            recordSchemas={recordSchemas}
            triggerModelFields={triggerModelFields()}
            triggerModelName={triggerModel?.tableName}
            includeOldRecord={!!hasOldRecord}
            includeRequestor
            onChange={(v: string) => setParam(p.name, v)}
          />
        );
      case 'attachment_list': {
        const items: any[] = Array.isArray(value) ? value : [];
        const addItem = () => setParam(p.name, [...items, { source: 'record_field', fieldName: '', filename: '' }]);
        const updateItem = (idx: number, patch: any) => {
          const next = [...items];
          next[idx] = { ...next[idx], ...patch };
          setParam(p.name, next);
        };
        const removeItem = (idx: number) => setParam(p.name, items.filter((_, i) => i !== idx));
        return (
          <div>
            {items.length === 0 ? (
              <p className="ws-props-hint">No attachments configured. Attach files from record fields, workflow variables, or URLs.</p>
            ) : (
              items.map((a, i) => (
                <div key={i} style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <select className="ws-props-input" style={{ width: 120 }} value={a.source || 'record_field'}
                      onChange={(e) => updateItem(i, { source: e.target.value, fieldName: '', variableName: '', url: '' })}>
                      <option value="record_field">Record Field</option>
                      <option value="variable">Variable</option>
                      <option value="url">URL</option>
                    </select>
                    {a.source === 'record_field' && (
                      <input className="ws-props-input" placeholder="Field name (attachment type)" value={a.fieldName || ''}
                        onChange={(e) => updateItem(i, { fieldName: e.target.value })} />
                    )}
                    {a.source === 'variable' && (
                      <input className="ws-props-input" placeholder="Variable name (or var.col)" value={a.variableName || ''}
                        onChange={(e) => { const [vn, fk] = e.target.value.split('.'); updateItem(i, { variableName: vn, fieldKey: fk || '' }); }} />
                    )}
                    {a.source === 'url' && (
                      <input className="ws-props-input" placeholder="https://..." value={a.url || ''}
                        onChange={(e) => updateItem(i, { url: e.target.value })} />
                    )}
                    <button className="ws-icon-btn ws-icon-btn--danger" title="Remove" onClick={() => removeItem(i)}><Trash2 size={12} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className="ws-props-input" placeholder="Display filename (optional)" value={a.filename || ''} style={{ flex: 1 }}
                      onChange={(e) => updateItem(i, { filename: e.target.value })} />
                    {a.cid !== undefined ? (
                      <input className="ws-props-input" placeholder="Content-ID" value={a.cid || ''} style={{ width: 100 }}
                        onChange={(e) => updateItem(i, { cid: e.target.value })} />
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addItem}>
              <Paperclip size={11} /> Add Attachment
            </button>
          </div>
        );
      }
      case 'text':
        if (p.name === 'recipients') {
          // Recipient chips (type + Enter, … picker, drag, or ƒ expression).
          return (
            <RecipientsChipsInput
              value={value ?? ''}
              onChange={(v) => setParam(p.name, v)}
              variables={variables}
              recordSchemas={recordSchemas}
              recordSchema={recordSchema}
              triggerModelFields={triggerModelFields()}
              triggerModelName={triggerModel?.tableName}
              includeOldRecord={!!hasOldRecord}
              includeRequestor
              placeholder="Type an email or {{variable}}…"
            />
          );
        }
        if (p.name === 'subject') {
          // Variable-aware text box — type text, {{ intellisense, … picker, drag, ƒ.
          return (
            <VariableTextInput
              value={value ?? ''}
              onChange={(v) => setParam(p.name, v)}
              variables={variables}
              recordSchemas={recordSchemas}
              recordSchema={recordSchema}
              triggerModelFields={triggerModelFields()}
              triggerModelName={triggerModel?.tableName}
              includeOldRecord={!!hasOldRecord}
              includeRequestor
              placeholder="Subject — type {{ to reference variables…"
            />
          );
        }
        return <input className="ws-props-input" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} />;
      default:
        return <input className="ws-props-input" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} />;
    }
  };

  const showMappingReview =
    activeStep !== null &&
    activeStep.parameters.some((p) => p.type === 'field_mapping') &&
    fieldMapping.length > 0 &&
    !isReadList;

  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal ws-qstudio-modal" onClick={(e) => e.stopPropagation()} style={{ width: 760, height: 'min(640px, 90vh)' }}>
        <div className="ws-wizard-toast-host">
          <UiToast message={mapToast} tone="error" />
        </div>
        <div className="ws-modal__header">
          <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Database size={16} /></span>
          <div className="ws-modal__titles">
            <span className="ws-modal__title">{OPERATION_LABELS[op] || 'Workflow Event'} Configuration</span>
            <span className="ws-modal__sub">Step {currentTab + 1} of {tabs.length} · {config.model || 'No model selected'}</span>
          </div>
          <button className="ws-icon-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="ws-modal__body">
          {/* Tab bar — standard platform tabs (admin-common .sails-tab-btn) */}
          <div style={{ display: 'flex', gap: 4, padding: '0 12px', borderBottom: '1px solid var(--sails-border)', flexWrap: 'wrap' }}>
            {tabs.map((t, i) => {
              const tabIssues = issueForTab(i);
              return (
                <button
                  key={t.label}
                  type="button"
                  className={`sails-tab-btn${currentTab === i ? ' sails-tab-btn--active' : ''}`}
                  onClick={() => { setActiveTab(i); setErrorBanner(null); }}
                >
                  {t.label}
                  {tabIssues.length > 0 && (
                    <span
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }}
                      title={tabIssues[0].message}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {errorBanner && (
            <div className="ws-banner" style={{ margin: '10px 12px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 11 }}>
              <AlertTriangle size={12} /> {errorBanner}
            </div>
          )}

          <div style={{ padding: 12 }}>
            {/* Tab 0 — Event (name + description) */}
            {currentTab === 0 && (
              <>
                <div className="ws-props-group" style={{ paddingTop: 0 }}>
                  <label className="ws-props-label">Name</label>
                  <input className="ws-props-input" value={label} onChange={(e) => { onLabelChange(e.target.value); setErrorBanner(null); }} placeholder="Event name" />
                  {!label.trim() && <p className="ws-props-hint" style={{ padding: '2px 0 0', color: '#ef4444' }}>Event name is required.</p>}
                </div>
                <div className="ws-props-group">
                  <label className="ws-props-label">Description</label>
                  <textarea className="ws-props-input ws-props-textarea" value={description} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="What does this event do?" rows={3} />
                </div>
              </>
            )}

            {/* Schema step tabs */}
            {currentTab > 0 && (() => {
              const opParam = stepParams.find((p) => p.type === 'operation_select');
              const filterParam = stepParams.find((p) => p.type === 'filter_builder');
              const targetTypeParam = stepParams.find((p) => p.name === 'targetType');
              const targetValueParam = stepParams.find((p) => p.name === 'targetValue');
              const others = stepParams.filter((p) => p !== opParam && p !== filterParam && p !== targetTypeParam && p !== targetValueParam);
              return (
                <>
                  {others.map((p) => (
                    <div key={p.name} className="ws-props-group">
                      <label className="ws-props-label">{p.label}{p.required ? ' *' : ''}</label>
                      {renderParam(p)}
                      {p.description && <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>{p.description}</p>}
                    </div>
                  ))}
                  {opParam && filterParam && (
                    <div className="ws-props-group">
                      <label className="ws-props-label">{opParam.label}</label>
                      <div className="ws-props-row" style={{ gap: 8 }}>
                        <div style={{ flex: 1 }}>{renderParam(opParam)}</div>
                        <button
                          type="button"
                          className="ws-props-input"
                          disabled={!isReadList || !hasValidModel}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isReadList && hasValidModel ? 'pointer' : 'not-allowed', opacity: isReadList && hasValidModel ? 1 : 0.55, whiteSpace: 'nowrap' }}
                          onClick={() => isReadList && hasValidModel && onOpenFilterBuilder(eventId)}
                          title={!hasValidModel ? 'Select a target model to build a filter' : isReadList ? 'Build a filter with QueryStudio' : 'Available for Read / List operations'}
                        >
                          <Filter size={12} />
                          {(() => {
                            const n = (config.filterGroups || []).reduce((acc: number, g: any) => acc + (g.rules?.length || 0), 0);
                            return n > 0 ? `${n} rule${n > 1 ? 's' : ''}` : 'Filter';
                          })()}
                        </button>
                      </div>
                    </div>
                  )}
                  {isTargetable && targetTypeParam && (
                    <div className="ws-props-group" style={{ borderTop: '1px solid var(--sails-border)', paddingTop: 10, marginTop: 2 }}>
                      <label className="ws-props-label">{targetTypeParam.label}</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {renderParam(targetTypeParam)}
                        {targetValueParam && renderParam(targetValueParam)}
                      </div>
                      <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>Which record this operation targets. For upsert it selects the record to update when the id already exists. Hidden for create/list — those operate on the triggering record itself.</p>
                    </div>
                  )}
                </>
              );
            })()}

            {showMappingReview && (
              <div style={{ padding: '0 0 8px' }}>
                <label className="ws-props-label" style={{ marginBottom: 4 }}>Mappings ({fieldMapping.length})</label>
                {fieldMapping.map((m, i) => (
                  <div key={i} className="ws-props-row" style={{ gap: 6, marginBottom: 3 }}>
                    <code style={{ fontSize: 10, minWidth: 80 }}>{m.sourceVar || m.sourceField}{m.itemIndex != null ? `[${m.itemIndex}]` : ''}</code>
                    <span style={{ fontSize: 10, color: 'var(--sails-text-muted)' }}>→</span>
                    <code style={{ fontSize: 10, minWidth: 80 }}>{m.targetCol}</code>
                    <button className="ws-icon-btn" onClick={() => onConfigChange('fieldMapping', fieldMapping.filter((_, j) => j !== i))}><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ws-modal__footer">
          <button className="sails-btn sails-btn--danger sails-btn--sm ws-props-delete-btn" style={{ marginRight: 'auto' }} onClick={() => onRemove(eventId)}>
            <Trash2 size={12} /> Remove Event
          </button>
          <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onClose}>Cancel</button>
          <button
            className="sails-btn sails-btn--ghost sails-btn--sm"
            onClick={() => setActiveTab(Math.max(0, currentTab - 1))}
            disabled={currentTab === 0}
          >
            <CornerUpLeft size={13} /> Previous
          </button>
          {isLastTab ? (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={finish}>
              <CheckCircle2 size={14} /> Complete
            </button>
          ) : (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setActiveTab(currentTab + 1)}>
              Next <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowEventWizard;
