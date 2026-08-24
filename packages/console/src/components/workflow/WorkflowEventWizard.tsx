/**
 * WorkflowEventWizard — step-by-step configuration modal for a workflow
 * event node (Record/Expression/Notification/Script/Approval) incl. field
 * mapping, filter groups and JSONata expressions.
 */
import React, { useState } from 'react';
import { AlertTriangle, AlignLeft, ArrowDown, ArrowRight, ArrowUp, Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, CornerUpLeft, Database, DollarSign, Eye, FileText, Filter, Fingerprint, GitMerge, Hash, Link2, List, ListChecks, Mail, MapPin, Paperclip, Pencil, Percent, Phone, Plus, Search, ToggleLeft, Trash2, Type, User, X, type LucideIcon } from 'lucide-react';
import type {
  WorkflowEventType,
  WorkflowEventConfigStep,
  WorkflowEventConfigParameter,
} from '@sails/shared';
import { WORKFLOW_EVENT_CONFIGS, SYSTEM_PROTECTED_COLUMNS, STRUCTURED_TYPE_SUBFIELDS } from '@sails/shared';
import { CustomSelect } from '../common/CustomSelect';
import type { SailsTableDefinition } from '@sails/shared';
import { SailsHtmlEditor } from '../shared/SailsHtmlEditor';
import { VariableTextInput } from './VariableTextInput';
import { WorkflowVariablePicker, buildContextRoot, flattenTree, filterTree, type PickerSchemaMap, type PickerColumn, type TreeNode } from './WorkflowVariablePicker';
import { AssignToEditor } from './AssignToEditor';
import { ActionsEditor } from './ActionsEditor';
import { ExitConditionsEditor, type WorkflowExitLine, type ExitLinePatch } from './ExitConditionsEditor';
import type { DrillRoots } from './jsonataSuggest';
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
  source?: 'variable' | 'record' | 'record_old' | 'wf' | 'value';
  sourceVar?: string;
  sourceField?: string;
  /** Item index into a collection variable (default 0 = first item). */
  itemIndex?: number;
  /** Fixed literal value when source === 'value'. */
  value?: any;
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
  /** Layout form controls for the Output step's "To Form Controls" mode. */
  formControls?: { fieldId: string; fieldName: string; name: string; logicalType: string; config?: any }[];
  /** Form-output-only mode (Layout Studio): no workflow variables — the Result
   *  Variable control and its validation are hidden; output maps to form
   *  controls only. */
  formOutputOnly?: boolean;
  /** Triggering record schema (columns) — enables `record.<field>` intellisense. */
  recordSchema?: PickerColumn[];
  /** Create a collection workflow variable for read/list results; returns its id. */
  onCreateCollectionVariable: (name: string, modelTableName: string) => string;
  /** Workflow-context drill roots (record / oldRecord / requestor) for the expression editor. */
  drillRoots?: DrillRoots;
  /** Task Approval only: the host stage's exit conditions (last "Exit" tab). */
  exitConditions?: {
    lines: WorkflowExitLine[];
    actions: { value: string; label: string }[];
    stageNames: Record<string, string>;
    disabled?: boolean;
    expression?: React.ComponentProps<typeof ExitConditionsEditor>['expression'];
    onAdd: (patch: ExitLinePatch) => void;
    onUpdate: (id: string, patch: ExitLinePatch) => void;
    onRemove: (id: string) => void;
  };
  /** Create a record workflow variable for read results; returns its id. */
  onCreateRecordVariable: (name: string, modelTableName: string) => string;
  onBindVariableToEvent: (varId: string, eventId: string, modelName: string, fieldType?: 'record' | 'collection') => void;
  onOpenExpressionEditor: (eventId: string) => void;
  onOpenFilterBuilder: (eventId: string) => void;
  /** Task Approval only: opens the QueryStudio builder for an assignee rule's condition. */
  onOpenAssigneeRuleCondition?: (eventId: string, ruleId: string) => void;
  /** When provided, variable pickers in this wizard show a '+ Add' button. */
  onAddVariable?: (anchorEl?: HTMLElement) => void | Promise<string | null>;
  /**
   * Write-through: every parameter edit lands directly in the live event
   * config (no local draft), so QueryStudio and other consumers always see
   * the current values. The console snapshots config on open and restores it
   * when the wizard is closed without Done.
   */
  onConfigChange: (name: string, value: any) => void;
  /** Called after +Create builds a variable — the host selects it so setup continues. */
  onSelectVariable?: (varId: string) => void;
  /** Done — the config is already committed via onConfigChange; just close. */
  onDone: () => void;
  /** Remove the event entirely (closes the wizard). */
  onRemove: (eventId: string) => void;
  onClose: () => void;
}

const STR = new Set(['short_text', 'long_text', 'rich_text', 'email', 'phone', 'url', 'select', 'user', 'text', 'varchar', 'char', 'relation', 'uuid']);
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

/** Icons for the operation button grid. */
const OPERATION_ICONS: Record<string, LucideIcon> = {
  create: Plus, update: Pencil, upsert: GitMerge, delete: Trash2, read: Eye, list: List,
};

/** One-line descriptions under each operation button (like the Start Condition). */
const OPERATION_DESCS: Record<string, string> = {
  create: 'Insert a new record',
  update: 'Change an existing record',
  upsert: 'Insert or update by its id',
  delete: 'Delete matching record(s)',
  read: 'Fetch a single record',
  list: 'Fetch all matching records',
};

/** Human labels for variable fieldTypes and model column logicalTypes. */
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text', short_text: 'Short Text', long_text: 'Long Text', rich_text: 'Rich Text',
  email: 'Email', phone: 'Phone', url: 'URL', select: 'Select',
  number: 'Number', decimal: 'Decimal', currency: 'Currency', percentage: 'Percentage', auto_number: 'Auto Number',
  boolean: 'Boolean',
  date: 'Date', datetime: 'Date & Time', time: 'Time',
  user: 'User', relation: 'Relation', address: 'Address', lat_lng: 'Lat / Lng', attachment: 'Attachment',
  record: 'Record', collection: 'Collection', uuid: 'UUID',
};

// Type tint + icon per field type (shared by both mapping panels).
const TYPE_COLOR: Record<string, string> = {
  short_text: '#64748b', long_text: '#64748b', rich_text: '#64748b', email: '#64748b', phone: '#64748b', url: '#64748b', select: '#64748b',
  number: '#3b82f6', decimal: '#3b82f6', currency: '#3b82f6', percentage: '#3b82f6', auto_number: '#3b82f6',
  boolean: '#10b981',
  date: '#f59e0b', datetime: '#f59e0b', time: '#f59e0b',
  user: '#8b5cf6', relation: '#8b5cf6', uuid: '#a855f7',
};
const TYPE_ICONS: Record<string, LucideIcon> = {
  short_text: Type, long_text: AlignLeft, rich_text: FileText, email: Mail, phone: Phone, url: Link2, select: List,
  number: Hash, decimal: Hash, currency: DollarSign, percentage: Percent, auto_number: Hash,
  boolean: ToggleLeft,
  date: Calendar, datetime: Calendar, time: Clock,
  user: User, relation: Link2, address: MapPin, lat_lng: MapPin, attachment: Paperclip, uuid: Fingerprint,
};
const typeColor = (t: string) => TYPE_COLOR[t] || '#64748b';
const typeIcon = (t: string) => TYPE_ICONS[t] || Type;
const typeLabel = (t: string) => FIELD_TYPE_LABELS[t] || t;

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
  variables, tables, triggerModel, hasOldRecord, recordSchemas, recordSchema, drillRoots, exitConditions, formControls, formOutputOnly,
  onCreateCollectionVariable, onCreateRecordVariable, onBindVariableToEvent,
  onOpenExpressionEditor, onOpenFilterBuilder, onOpenAssigneeRuleCondition, onAddVariable, onSelectVariable,
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
  const [showMapSummary, setShowMapSummary] = useState(false);
  // Click-to-assign: the active source leaf (click a leaf, then a column).
  const [clickSrc, setClickSrc] = useState<{ source?: 'variable' | 'record' | 'record_old' | 'wf' | 'value'; sourceVar?: string; sourceField?: string; itemIndex?: number; fieldType?: string; name?: string; value?: any } | null>(null);
  // Fixed-value literal for the mapping rail's "Fixed value" editor.
  const [literalDraft, setLiteralDraft] = useState('');
  // Column awaiting a typed/picked fixed value (option 2: click column first).
  const [valueTarget, setValueTarget] = useState<any | null>(null);
  // Independent rail scroll offsets (lines overlay is scroll-independent).
  const [leftScroll, setLeftScroll] = useState(0);
  const [rightScroll, setRightScroll] = useState(0);
  const mapRowRef = React.useRef<HTMLDivElement | null>(null);
  const leftRowsRef = React.useRef<HTMLDivElement | null>(null);
  const rightRowsRef = React.useRef<HTMLDivElement | null>(null);
  // Output mapping (result fields → variables) panel state.
  const [outSelMapIdx, setOutSelMapIdx] = useState<number | null>(null);
  const [outClickSrc, setOutClickSrc] = useState<{ sourceField: string; fieldType: string; name?: string } | null>(null);
  /** Output target mode: workflow variables or the layout's form controls. */
  const [outMode, setOutMode] = useState<'vars' | 'form'>('vars');
  const [outDropFeedback, setOutDropFeedback] = useState<{ col: string; ok: boolean } | null>(null);
  const [outDragPreview, setOutDragPreview] = useState<{ srcIndex: number; tgtIndex: number; ok: boolean; cx: number; cy: number } | null>(null);
  const [outLeftScroll, setOutLeftScroll] = useState(0);
  const [outRightScroll, setOutRightScroll] = useState(0);
  const [outResSearch, setOutResSearch] = useState('');
  const [outVarSearch, setOutVarSearch] = useState('');
  const outMapRowRef = React.useRef<HTMLDivElement | null>(null);
  const outLeftRowsRef = React.useRef<HTMLDivElement | null>(null);
  const outRightRowsRef = React.useRef<HTMLDivElement | null>(null);
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
  // click-to-assign sources (never while typing).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (typing) return;
        setClickSrc(null);
        setOutClickSrc(null);
        return;
      }
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (typing) return;
      if (selMapIdx !== null) {
        e.preventDefault();
        const fm = config.fieldMapping || [];
        if (fm[selMapIdx]) onConfigChange('fieldMapping', fm.filter((_: any, j: number) => j !== selMapIdx));
        setSelMapIdx(null);
      } else if (outSelMapIdx !== null) {
        e.preventDefault();
        if (formOutputOnly || outMode === 'vars') {
          const om: { sourceField: string; targetVar: string }[] = config.outputMapping || [];
          if (om[outSelMapIdx]) onConfigChange('outputMapping', om.filter((_: any, j: number) => j !== outSelMapIdx));
        } else {
          const fm: { sourceField: string; targetFieldId: string }[] = config.formOutputMapping || [];
          if (fm[outSelMapIdx]) onConfigChange('formOutputMapping', fm.filter((_: any, j: number) => j !== outSelMapIdx));
        }
        setOutSelMapIdx(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selMapIdx, outSelMapIdx, outMode, formOutputOnly, config, onConfigChange]);

  // The event config is LIVE (write-through) — no local draft. `config` is
  // refreshed by the parent on every onConfigChange.
  const fieldMapping: MappingEntry[] = config.fieldMapping || [];

  const schema = WORKFLOW_EVENT_CONFIGS[eventType] || [];
  // No auto-selected action: until the user picks one, `op` is empty (the
  // engine keeps a runtime 'read' fallback for legacy configs only).
  const op = String(config.operation || '');

  // System columns are engine-managed — never mappable for create/update/upsert
  // (runtime strips them via stripProtectedColumns anyway). Exception: `id`
  // stays mappable for update/delete/upsert — for update/delete it IS the
  // target record; for upsert it's the ON CONFLICT key.
  const isMappableTarget = (name: string): boolean => {
    if (op === 'delete') return true; // delete's payload is unused; only id matters
    if (op !== 'create' && op !== 'update' && op !== 'upsert') return true;
    // `id` (UUID) is mappable for every writable op: update/delete target it,
    // upsert uses it as the ON CONFLICT key, create can supply its own UUID.
    if ((op === 'create' || op === 'update' || op === 'upsert') && name === 'id') return true;
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
  // read/list are filter-driven (read returns one row, list many);
  // update/delete target via the ID mapping (filters forbidden), upsert
  // conflicts on the mapped id.
  const canFilter = op === 'read' || op === 'list';
  // All targets come from the Input id mapping / Record Filter — no Target Record group.
  const isTargetable = false;
  // Visible steps per operation: read/list have no Input; delete has no Output.
  // Visible steps per operation: read/list have no Input (their target is the
  // QueryStudio filter); delete has no Output.
  const steps = (op === 'read' || op === 'list')
    ? schema.filter((s) => s.label !== 'Input')
    : op === 'delete'
      ? schema.filter((s) => s.label !== 'Output')
      : schema;
  const tabs = [{ label: 'Event' }, ...steps.map((s) => ({ label: s.label }))];
  // Task Approval: append the shared Exit Conditions editor as the LAST tab.
  if (eventType === 'approval') tabs.push({ label: 'Exit Condition' });
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

  /** The workflow root model's fields in picker shape (record/oldRecord branches),
   * always including the record's ID (UUID) — metadata excludes it. */
  const triggerModelFields = (): PickerColumn[] | undefined => {
    if (!triggerModel?.fields) return undefined;
    const cols = (triggerModel.fields as any[]).map((f: any) => ({
      fieldName: f.fieldName || f.name, label: f.name || f.fieldName,
      logicalType: f.logicalType || f.physicalType || 'text',
    }));
    if (!cols.some((c) => c.fieldName === 'id')) cols.unshift({ fieldName: 'id', label: 'ID', logicalType: 'uuid' });
    return cols;
  };

  // One-time migration: legacy notification configs store recipients under the
  // shared `recipients` key with a `channel` flag. Seed the per-channel fields
  // so the Email/Bell panels show the existing recipients on first open.
  const migratedRef = React.useRef(false);
  React.useEffect(() => {
    if (migratedRef.current) return;
    const raw = config.recipients;
    if (raw == null || raw === '' || Array.isArray(raw) && raw.length === 0) return;
    if (config.emailRecipients != null || config.bellRecipients != null) return;
    const ch = String(config.channel || 'bell');
    migratedRef.current = true;
    // Legacy chips format is an array — the new panels use plain text.
    const asText = Array.isArray(raw) ? raw.join(', ') : String(raw);
    const patch: Record<string, any> = {};
    if (ch === 'email' || ch === 'both') patch.emailRecipients = asText;
    if (ch === 'bell' || ch === 'both') patch.bellRecipients = asText;
    onConfigChange('recipients', undefined);
    for (const [k, v] of Object.entries(patch)) onConfigChange(k, v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Task Approval: seed the Actions list from the legacy canApprove / canReject
  // flags the first time the step is opened (new/legacy events both start with
  // Approve + Reject, honoring the flags). Once the user edits Actions, the
  // list is the source of truth.
  const actionsSeededRef = React.useRef(false);
  React.useEffect(() => {
    if (eventType !== 'approval' || actionsSeededRef.current) return;
    if (Array.isArray(config.actions) && config.actions.length > 0) { actionsSeededRef.current = true; return; }
    actionsSeededRef.current = true;
    const seed: { label: string; value: string }[] = [];
    if (config.canApprove !== false) seed.push({ label: 'Approve', value: 'approve' });
    if (config.canReject !== false) seed.push({ label: 'Reject', value: 'reject' });
    if (seed.length > 0) onConfigChange('actions', seed);
    // Seeded defaults never auto-create exit conditions — only actions the
    // user genuinely adds do.
    for (const a of seed) handledActionsRef.current.add(a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParam = (name: string, value: any) => {
    onConfigChange(name, value);
    // Dependent state resets when the model/operation changes.
    if (name === 'model' || name === 'operation') {
      onConfigChange('filterGroups', []);
      onConfigChange('fieldMapping', []);
    }
  };

  // Task Approval: every newly-created Workflow Action gets a matching Exit
  // Condition automatically (line routes on the action's value → Completed).
  // Only actions the user genuinely adds are "unhandled" — actions present at
  // open (loaded configs) and the seeded defaults are marked handled and never
  // auto-create, so merely focusing/blurring the Actions box creates nothing.
  const handledActionsRef = React.useRef<Set<string>>(
    new Set((Array.isArray(config.actions) ? config.actions : []).map((a: any) => a.value)),
  );
  const createExitForAction = (a: { label: string; value: string }) => {
    if (!exitConditions || exitConditions.disabled) return;
    handledActionsRef.current.add(a.value);
    if (exitConditions.lines.some((l) => l.action === a.value)) return;
    exitConditions.onAdd({ label: a.label, action: a.value, votePolicy: 'at_least', voteCount: 1 });
  };
  // Quick-add chips fire immediately (discrete creation).
  const handleActionAdded = (a: { label: string; value: string }) => {
    createExitForAction(a);
  };
  // Typed lines are synced when the textarea loses focus (e.g. leaving the
  // tab) — mid-typing fragments never become exit lines.
  const syncExitConditionsForActions = () => {
    if (!exitConditions || exitConditions.disabled) return;
    const actions = Array.isArray(config.actions) ? config.actions : [];
    const existing = new Set(exitConditions.lines.map((l) => l.action));
    for (const a of actions) {
      if (handledActionsRef.current.has(a.value)) continue;
      handledActionsRef.current.add(a.value);
      if (existing.has(a.value)) continue;
      exitConditions.onAdd({ label: a.label, action: a.value, votePolicy: 'at_least', voteCount: 1 });
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
      if (c.fieldName === 'id') continue; // every record carries its ID (UUID)
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
        if (formOutputOnly && p.type === 'variable_auto_create') continue;
        if (isEmptyValue(config[p.name])) {
          issues.push({ tab: i + 1, message: `${p.label} is required.` });
        }
      }
    });
    const mismatch = formOutputOnly ? null : variableStructureIssue();
    if (mismatch) {
      const outTab = steps.findIndex((s) => s.parameters.some((p) => p.name === 'storeToVariable'));
      issues.push({ tab: Math.max(outTab + 1, 1), message: mismatch });
    }

    if (eventType === 'record') {
      const mapping: MappingEntry[] = config.fieldMapping || [];
      const hasId = mapping.some((m) => m.targetCol === 'id');
      const nonId = mapping.filter((m) => m.targetCol !== 'id').length;
      const hasFilter = (config.filterGroups || []).some((g: any) => g?.rules?.length > 0);
      const inTab = Math.max(steps.findIndex((s) => s.parameters.some((p) => p.type === 'field_mapping')) + 1, 1);

      // delete: exactly the ID (UUID) mapped, no filters.
      if (op === 'delete') {
        if (!hasId) issues.push({ tab: inTab, message: 'Delete requires the ID (UUID) mapped in Input.' });
        if (nonId > 0) issues.push({ tab: inTab, message: 'Delete only maps the ID (UUID) — remove the other input mappings.' });
        if (hasFilter) issues.push({ tab: inTab, message: "Delete doesn't use a Record Filter — clear it." });
      }
      // read: filter-driven (returns one row) — ID mapping optional; no payload columns.
      else if (op === 'read') {
        if (nonId > 0) issues.push({ tab: inTab, message: 'Read only maps the ID (UUID) — remove the other input mappings.' });
      }
      // update: the ID (UUID) is required, no filters.
      else if (op === 'update') {
        if (!hasId) issues.push({ tab: inTab, message: 'Update requires the ID (UUID) mapped in Input.' });
        if (hasFilter) issues.push({ tab: inTab, message: "Update doesn't use a Record Filter — clear it." });
      }

      // Output variable must be mapped (and typed correctly).
      if (op !== 'delete' && !formOutputOnly) {
        const outTab = Math.max(steps.findIndex((s) => s.parameters.some((p) => p.name === 'storeToVariable')) + 1, 1);
        const name = String(config.storeToVariable || '').trim();
        if (!name) {
          issues.push({ tab: outTab, message: 'Output variable must be mapped — create it with the Create button or pick an existing one.' });
        } else {
          const def = variables.find((v) => v.name === name);
          const wantCollection = op === 'list';
          if (def && ((wantCollection && def.fieldType !== 'collection') || (!wantCollection && def.fieldType !== 'record'))) {
            issues.push({ tab: outTab, message: `Output variable '${name}' must be a ${wantCollection ? 'collection' : 'record'} variable.` });
          }
        }
      }
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
    // The output variable must already be mapped (via Create or the picker) —
    // Complete never auto-creates.
    onDone();
  };

  const renderParam = (p: WorkflowEventConfigParameter) => {
    const value = config[p.name];
    // Notification delivery rows for Task Approval.
    if (eventType === 'approval' && p.name === 'notifyBell') return null;
    switch (p.type) {
      case 'assignee':
        return (
          <AssignToEditor
            config={config}
            onConfigChange={onConfigChange}
            variables={variables}
            recordSchema={(triggerModel?.fields || []).map((f: any) => ({
              fieldName: f.fieldName ?? f.columnName ?? f.id,
              label: f.name ?? f.label ?? f.fieldName,
              logicalType: f.logicalType ?? f.physicalType ?? 'text',
              ...(f.logicalType === 'relation' || f.logicalType === 'lookup'
                ? { targetModel: f.config?.targetTable ?? f.config?.targetModel ?? undefined }
                : {}),
            }))}
            recordSchemas={recordSchemas}
            onOpenAssigneeRuleCondition={onOpenAssigneeRuleCondition ? (ruleId) => onOpenAssigneeRuleCondition(eventId, ruleId) : undefined}
          />
        );
      case 'workflow_actions':
        return (
          <ActionsEditor
            value={Array.isArray(value) ? value : []}
            onChange={(a) => setParam(p.name, a)}
            onActionAdded={handleActionAdded}
            onBlur={syncExitConditionsForActions}
          />
        );
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
      case 'operation_select': {
        // Action cards (3 columns × 2 rows) — same size/style as the Start
        // Condition cards. No action is auto-selected; the grid stays disabled
        // until a model is chosen.
        const current = String(value || '');
        return (
          <div className="ws-wiz-op-grid">
            {Object.entries(OPERATION_LABELS).map(([v, l]) => {
              const OpIcon = OPERATION_ICONS[v] || Database;
              const sel = current === v;
              return (
                <button
                  key={v}
                  type="button"
                  className={`ws-wizard-card ${sel ? 'ws-wizard-card--selected' : ''}`}
                  style={{ opacity: hasValidModel ? 1 : 0.5, cursor: hasValidModel ? 'pointer' : 'not-allowed' }}
                  disabled={!hasValidModel}
                  title={l}
                  onClick={() => setParam(p.name, v)}
                >
                  <span className="ws-wizard-card__icon">
                    <OpIcon size={18} />
                  </span>
                  <span className="ws-wizard-card__title">{l}</span>
                  <span className="ws-wizard-card__desc">{OPERATION_DESCS[v]}</span>
                  <span className="ws-wizard-card__check">{sel && <CheckCircle2 size={14} />}</span>
                </button>
              );
            })}
          </div>
        );
      }
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
        if (formOutputOnly) return null; // Layout Studio: no workflow variables
        // Output result variable for every operation except delete (its step
        // is hidden). list → collection; read and all writes → record.
        // The control is the shared VariableTextInput; a Create button builds
        // the variable and maps it (no auto-create on Complete).
        const isListOp = op === 'list';
        const toName = (ref: string) => String(ref || '').replace(/[{}]/g, '').split('.')[0].trim();
        const mismatch = variableStructureIssue();
        const mappedName = String(config.storeToVariable || '').trim();
        const createAndMap = () => {
          if (!config.model) return;
          const name = mappedName || `${op}_${config.model}`;
          const varId = isListOp
            ? onCreateCollectionVariable(name, config.model)
            : onCreateRecordVariable(name, config.model);
          onConfigChange('storeToVariable', name);
          if (varId) {
            onBindVariableToEvent(varId, eventId, config.model, isListOp ? 'collection' : 'record');
            onSelectVariable?.(varId);
          }
        };
        return (
          <>
            <div className="ws-props-row" style={{ gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <VariableTextInput
                  value={mappedName ? `{{${mappedName}}}` : ''}
                  onChange={(ref) => onConfigChange('storeToVariable', toName(ref))}
                  variables={variables}
                  recordSchemas={recordSchemas}
                  recordSchema={recordSchema}
                  triggerModelFields={triggerModelFields()}
                  triggerModelName={triggerModel?.tableName}
                  includeOldRecord={!!hasOldRecord}
                  includeRequestor
                  onAddVariable={onAddVariable}
                  placeholder={isListOp ? 'Pick a collection variable…' : 'Pick a record variable…'}
                />
              </div>
              <button
                type="button"
                className="sails-btn sails-btn--ghost sails-btn--sm"
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
                onClick={createAndMap}
                disabled={!hasValidModel || !!mappedName}
                title={mappedName ? 'Output variable already mapped' : 'Create the output variable and map it'}
              >
                <Plus size={12} /> Create
              </button>
            </div>
            {mappedName && (
              <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>
                Output variable <code>{mappedName}</code> is mapped{isListOp ? ' (collection)' : ' (record)'}.
              </p>
            )}
            {mismatch && (
              <p className="ws-props-hint" style={{ padding: '2px 0 0', color: '#ef4444' }}>{mismatch}</p>
            )}
            {!config.model && (
              <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>Select a model in the Action tab first.</p>
            )}
          </>
        );
      }
      case 'field_mapping': {
        // read/list never write — their Input step is hidden.
        // list has no Input step (its target is the filter).
        if (op === 'list') return null;
        const ROW_H = 34;
        const LABEL_H = 26;
        const SEARCH_H = 30;
        const ROW_GAP = 4;
        const ROW_PITCH = ROW_H + ROW_GAP;
        const ROWS_MAX = 200;
        // Compact section headers — they use their own (smaller) pitch.
        const SECTION_H = 22;
        const SECTION_GAP = 4;
        const SECTION_PITCH = SECTION_H + SECTION_GAP;
        const PORT_R = 6;
        // Port dot centers sit this far inside the rails' content edges
        // (12px dot + 2px side offset), so connector lines start/end exactly
        // on the dots instead of at the rail boundaries.
        const PORT_INSET = PORT_R + 2;
        const HEADER_H = LABEL_H + SEARCH_H;
        // 40% left · 20% drag gap · 40% right — measured from the flex row so
        // the overlay lines and ports stay in lockstep.
        const mapW = mapRowRef.current?.offsetWidth || 0;
        const svgLeft = mapW ? mapW * 0.4 : 280;
        const GAP_W = mapW ? Math.round(mapW * 0.2) : 160;
        const srcPortX = svgLeft - PORT_INSET;
        const tgtPortX = svgLeft + GAP_W + PORT_INSET;
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

        const sortRows = (rows: any[], dir: 'asc' | 'desc' | null) => {
          if (!dir) return rows;
          const sorted = [...rows].sort((a, b) =>
            String(a.name || a.fieldName || '').localeCompare(String(b.name || b.fieldName || ''))
          );
          return dir === 'desc' ? sorted.reverse() : sorted;
        };
        const cycleSort = (cur: 'asc' | 'desc' | null): 'asc' | 'desc' | null =>
          cur === 'asc' ? 'desc' : cur === 'desc' ? null : 'asc';

        // Every writable op targets via the pinned ID (UUID) column — update/
        // delete's target (required without a filter), upsert's conflict key,
        // and create's optional custom UUID. Metadata never includes it.
        const idTargetable = op === 'create' || op === 'update' || op === 'delete' || op === 'upsert';
        const idCol = { fieldName: 'id', name: 'ID', logicalType: 'uuid' };
        const displayColsAll = (op === 'read' || op === 'delete')
          // read/delete only target via the ID (UUID) — no payload columns.
          ? [idCol]
          : [
              ...(idTargetable && !modelFields.some((f: any) => (f.fieldName || f.name) === 'id') ? [idCol] : []),
              ...sortRows(modelFields.filter(isMappableCol), colSort),
            ];
        const colSearching = colSearch.trim().length > 0;
        const displayCols = colSearching
          ? displayColsAll.filter((c: any) => String(c.name || c.fieldName || '').toLowerCase().includes(colSearch.toLowerCase()))
          : displayColsAll;

        /** Same source descriptor (unmap-on-reapply); different source replaces. */
        const sameSource = (a: MappingEntry, b: { source?: 'variable' | 'record' | 'record_old' | 'wf' | 'value'; sourceVar?: string; sourceField?: string; itemIndex?: number }) =>
          (a.source || 'variable') === (b.source || 'variable')
          && a.sourceVar === b.sourceVar
          && a.sourceField === b.sourceField
          && (a.itemIndex ?? 0) === (b.itemIndex ?? 0);

        /** Shared map/replace/unmap for drag-drops and click-to-assign. */
        const tryMap = (desc: { source?: 'variable' | 'record' | 'record_old' | 'wf' | 'value'; sourceVar?: string; sourceField?: string; itemIndex?: number; fieldType?: string; name?: string; record?: boolean; modelName?: string; value?: any }, col: any) => {
          if (!isMappableCol(col)) return;
          const colType = col.logicalType || col.physicalType || 'text';
          let compat: boolean;
          if (desc.source === 'value') {
            // Fixed literal — the typed value is applied as-is (DB coerces).
            compat = true;
          } else if (desc.record) {
            // Whole record → relation/lookup of the SAME model (stores the id)
            // or a JSONB/record column (stores the object).
            const targetModel = col.config?.targetTable || col.targetModel;
            compat = (colType === 'relation' || colType === 'lookup')
              ? targetModel === desc.modelName
              : (colType === 'jsonb' || colType === 'record');
          } else {
            compat = isCompatibleType(desc.fieldType || '', colType);
          }
          setDropFeedback({ col: col.fieldName || col.name, ok: compat });
          if (compat) {
            notifyMapping(null);
            const targetCol = col.fieldName || col.name;
            const existing = fieldMapping.find((m) => m.targetCol === targetCol);
            const entry: MappingEntry = {
              source: desc.source || 'variable',
              sourceVar: desc.sourceVar,
              sourceField: desc.sourceField,
              itemIndex: desc.itemIndex,
              targetCol,
              ...(desc.source === 'value' ? { value: desc.value } : {}),
            };
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
            notifyMapping(`Can't map '${desc.name || desc.sourceVar || desc.sourceField}' (${typeLabel(desc.fieldType || '')}) → ${col.name || col.fieldName} (${typeLabel(colType)}) — ${desc.record ? 'model/type mismatch.' : 'field types are not compatible.'}`);
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
            <div className="ws-props-row" style={{ gap: 8, marginBottom: 8, position: 'relative' }}>
              <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={autoMap} title="Map variables to columns with the same name (compatible types only)">
                <Plus size={12} /> Auto Map by Name
              </button>
              <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => onConfigChange('fieldMapping', [])} disabled={fieldMapping.length === 0} title="Clear all mappings">
                <Trash2 size={12} /> Clear All
              </button>
              <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowMapSummary((v) => !v)} disabled={fieldMapping.length === 0} title="List the current mappings">
                <ListChecks size={12} /> Mapping Summary
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
              {showMapSummary && fieldMapping.length > 0 && (
                <div
                  style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 30, width: 340, maxHeight: 240, overflow: 'auto',
                    background: 'var(--sails-bg-card,#fff)', border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="ws-props-label" style={{ marginBottom: 4, display: 'block' }}>Mappings ({fieldMapping.length})</label>
                  {fieldMapping.map((m, i) => (
                    <div key={i} className="ws-props-row" style={{ gap: 6, marginBottom: 3 }}>
                      <code style={{ fontSize: 10, minWidth: 80 }}>{m.source === 'value' ? `Fixed: ${m.value}` : m.sourceVar || m.sourceField}{m.itemIndex != null ? `[${m.itemIndex}]` : ''}</code>
                      <span style={{ fontSize: 10, color: 'var(--sails-text-muted)' }}>→</span>
                      <code style={{ fontSize: 10, minWidth: 80 }}>{m.targetCol}</code>
                      <button className="ws-icon-btn" onClick={() => onConfigChange('fieldMapping', fieldMapping.filter((_, j) => j !== i))}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{ position: 'relative', padding: 4 }}
              onClick={() => { setSelMapIdx(null); setClickSrc(null); setValueTarget(null); }}
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
                  {/* Fixed value (literal) — type a value, click Use, then a column;
                      or click a column first and type/pick its value here */}
                  <div style={{ padding: '3px 0', borderBottom: '1px solid var(--sails-border,#e2e8f0)', marginBottom: 4 }} onClick={(e) => e.stopPropagation()}>
                    {valueTarget ? (
                      <>
                        <div style={{ fontSize: 9.5, color: 'var(--sails-text-muted)', marginBottom: 3 }}>
                          Value for <strong>{valueTarget.name || valueTarget.fieldName}</strong>:
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="wvp-search-input"
                            style={{ flex: 1, fontSize: 10, padding: '4px 6px', height: 24 }}
                            placeholder="Type a value…"
                            value={literalDraft}
                            onChange={(e) => setLiteralDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && literalDraft.trim()) {
                                tryMap({ source: 'value', value: literalDraft.trim(), fieldType: 'text', name: `Fixed: ${literalDraft.trim()}` }, valueTarget);
                                setValueTarget(null);
                                setLiteralDraft('');
                              } else if (e.key === 'Escape') {
                                setValueTarget(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="ws-icon-btn"
                            title="Apply this value to the column"
                            disabled={!literalDraft.trim()}
                            onClick={() => {
                              tryMap({ source: 'value', value: literalDraft.trim(), fieldType: 'text', name: `Fixed: ${literalDraft.trim()}` }, valueTarget);
                              setValueTarget(null);
                              setLiteralDraft('');
                            }}
                          ><ArrowRight size={12} /></button>
                        </div>
                        {(valueTarget.config?.options || []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                            {(valueTarget.config?.options || []).map((o: any, oi: number) => {
                              const v = o.value !== undefined && o.value !== null ? String(o.value) : String(o.label ?? '');
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--sails-border,#e2e8f0)', background: 'var(--sails-bg-card,#fff)', cursor: 'pointer' }}
                                  onClick={() => {
                                    setLiteralDraft(v);
                                    tryMap({ source: 'value', value: v, fieldType: 'text', name: `Fixed: ${o.label ?? v}` }, valueTarget);
                                    setValueTarget(null);
                                    setLiteralDraft('');
                                  }}
                                >{o.label ?? v}</button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="wvp-search-input"
                            style={{ flex: 1, fontSize: 10, padding: '4px 6px', height: 24 }}
                            placeholder="Fixed value… (e.g. Qualified)"
                            value={literalDraft}
                            onChange={(e) => { setLiteralDraft(e.target.value); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && literalDraft.trim()) {
                                setClickSrc({ source: 'value', value: literalDraft.trim(), fieldType: 'text', name: `Fixed: ${literalDraft.trim()}` });
                                setSelMapIdx(null);
                              } else if (e.key === 'Escape') {
                                setClickSrc(null);
                                setValueTarget(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="ws-icon-btn"
                            title="Use this value — click a column to map it"
                            disabled={!literalDraft.trim()}
                            onClick={() => {
                              setClickSrc({ source: 'value', value: literalDraft.trim(), fieldType: 'text', name: `Fixed: ${literalDraft.trim()}` });
                              setSelMapIdx(null);
                            }}
                          ><ArrowRight size={12} /></button>
                        </div>
                        {clickSrc?.source === 'value' && (
                          <div style={{ fontSize: 9.5, color: 'var(--sails-primary,#9dcee0)', padding: '3px 2px 0' }}>
                            Fixed: <code>{clickSrc.value}</code> — click a column to map (Esc to cancel)
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    ref={leftRowsRef}
                    style={{ maxHeight: ROWS_MAX, overflowY: 'auto', overflowX: 'hidden', paddingRight: 20 }}
                    onScroll={(e) => setLeftScroll(e.currentTarget.scrollTop)}
                  >
                    {srcRows.map(({ node: v, depth }, i) => {
                      const isSection = v.kind === 'section';
                      const isLeaf = v.kind === 'leaf';
                      const isRecordNode = v.kind === 'record' || v.kind === 'collection';
                      const hasChildren = !!v.children && v.children.length > 0;
                      const open = expandedSet.has(v.key);
                      const lt = isSection ? 'text' : v.logicalType || 'text';
                      const isClickSrcLeaf = !!clickSrc && clickSrc.source === v.source && clickSrc.sourceVar === v.varName && clickSrc.sourceField === v.fieldName;
                      const draggable = isLeaf || isRecordNode;
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
                              setValueTarget(null);
                            } else if (hasChildren) {
                              toggleSrc(v.key);
                            }
                          }}
                          draggable={draggable}
                          onDragStart={draggable ? (e) => {
                            e.stopPropagation();
                            // Keep the ghost glued to the grab point — the default
                            // anchors it top-left, which makes the drop drift.
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, e.clientX - rect.left, e.clientY - rect.top);
                            const itemIndex = isLeaf && v.itemKey
                              ? (parseInt(srcIndex[v.itemKey] || '0', 10) || 0)
                              : undefined;
                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'wiz-map', source: v.source, sourceVar: v.varName, sourceField: v.fieldName, itemIndex, record: !isLeaf, modelName: v.modelName, name: v.label, fieldType: lt, rowIndex: i }));
                            e.dataTransfer.effectAllowed = 'copy';
                            setDragPreview({ srcIndex: i, tgtIndex: -1, ok: false, cx: srcPortX, cy: yAtSrc(i) });
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
                          {(isLeaf || isRecordNode) && (
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
                      // The whole row accepts the drop — no pixel-perfect port hits.
                      return (
                        <div key={col.fieldName || col.name} className="wvp-node"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (clickSrc) {
                                tryMap(clickSrc, col);
                                if (clickSrc.source === 'value') setClickSrc(null);
                              } else if (mapped) {
                                onConfigChange('fieldMapping', fieldMapping.filter((m) => m.targetCol !== (col.fieldName || col.name)));
                              } else if (isMappableCol(col)) {
                                // No source pending — select the column to type/pick a fixed value.
                                setValueTarget(col);
                                setSelMapIdx(null);
                              }
                            }}
                            onDragOver={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            e.dataTransfer.dropEffect = 'copy';
                            const ok = isCompatibleType(
                              (() => { try { return JSON.parse(e.dataTransfer.getData('application/json')).fieldType || ''; } catch { return ''; } })(),
                              colType,
                            );
                            setDragPreview((prev) => (prev ? { ...prev, tgtIndex: ci, ok } : prev));
                            setDropFeedback({ col: col.fieldName || col.name, ok });
                          }}
                          onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                            e.preventDefault(); e.stopPropagation();
                            setDragPreview((prev) => (prev ? { ...prev, tgtIndex: -1 } : prev));
                            setDropFeedback(null);
                          }}
                          onDrop={(e) => handlePortDrop(e, col)}
                          style={{
                            position: 'relative', height: ROW_H, marginTop: 0, marginBottom: ROW_GAP, boxSizing: 'border-box', width: '100%', gap: 4,
                            background: mapped ? 'rgba(59,130,246,.08)' : (feedback ? (feedbackOk ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)') : undefined),
                            borderRadius: 4,
                          }}
                        >
                          {/* Visual port marker (the row itself is the drop zone) */}
                          <span
                            className="ws-map-port"
                            style={{ ...portStyle, left: 2, top: '50%', transform: 'translateY(-50%)' }}
                            title={mapped ? 'Drop to unmap' : `Drop to map a variable → ${col.name || col.fieldName}`}
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
                          d={connPath(srcPortX, yAtSrc(si), tgtPortX, yAtCol(ti))}
                          stroke={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'}
                          strokeWidth={sel ? 3 : 2}
                          fill="none"
                          strokeLinecap="round"
                          style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); setSelMapIdx(sel ? null : mi); }}
                        />
                        <circle cx={tgtPortX} cy={yAtCol(ti)} r={sel ? 4.5 : 3.5} fill={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'} style={{ pointerEvents: 'visiblePainted' }} onClick={(e) => { e.stopPropagation(); setSelMapIdx(sel ? null : mi); }} />
                      </g>
                    );
                  })}
                  {dragPreview && (
                    <path
                      d={
                        dragPreview.tgtIndex >= 0
                          ? connPath(srcPortX, yAtSrc(dragPreview.srcIndex), tgtPortX, yAtCol(dragPreview.tgtIndex))
                          : connPath(srcPortX, yAtSrc(dragPreview.srcIndex), Math.min(Math.max(dragPreview.cx, srcPortX), tgtPortX), dragPreview.cy)
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

      case 'output_mapping': {
        // Output: map single-record RESULT fields onto scalar workflow variables
        // (the sides are swapped vs Input). list/delete results are skipped by
        // the engine; delete's Output step is hidden entirely.
        // Layout mirrors the Input panel: label + search headers, same gutter.
        const OROW_H = 34;
        const OLABEL_H = 26;
        const OSEARCH_H = 30;
        const OHEADER_H = OLABEL_H + OSEARCH_H;
        const OGAP = 4;
        const OPITCH = OROW_H + OGAP;
        const OROWS_MAX = 200;
        const OPORT_R = 6;
        const OPORT_INSET = OPORT_R + 2; // port dot center offset from the rail content edge
        const omapW = outMapRowRef.current?.offsetWidth || 0;
        const osvgLeft = omapW ? omapW * 0.4 : 280;
        const oGAP_W = omapW ? Math.round(omapW * 0.2) : 160;
        const osrcX = osvgLeft - OPORT_INSET;
        const otgtX = osvgLeft + oGAP_W + OPORT_INSET;
        const resRowsAll = [
          // The result always carries the record's ID (UUID) — pinned first.
          ...(modelFields.some((f: any) => (f.fieldName || f.name) === 'id') ? [] : [{ key: 'res:id', label: 'ID', fieldType: 'uuid', sourceField: 'id' }]),
          ...modelFields.flatMap((f: any) => {
            const fn = f.fieldName || f.name;
            const lt = f.logicalType || f.physicalType || 'text';
            // Structured JSON types (address / lat_lng) flatten into sub-fields.
            const subs = STRUCTURED_TYPE_SUBFIELDS[lt];
            if (subs && subs.length > 0) {
              return subs.map((s) => ({
                key: `res:${fn}.${s.fieldName}`,
                label: `${f.name || fn} \u2192 ${s.label}`,
                fieldType: s.logicalType,
                sourceField: `${fn}.${s.fieldName}`,
              }));
            }
            return [{ key: `res:${fn}`, label: f.name || fn, fieldType: lt, sourceField: fn }];
          }),
        ];
        const varRowsAll = variables.filter((v) => v.name && v.fieldType !== 'collection' && v.fieldType !== 'record').map((v) => ({
          key: `ovar:${v.id}`, label: v.name, fieldType: v.fieldType,
        }));
        const resRows = outResSearch.trim()
          ? resRowsAll.filter((r) => r.label.toLowerCase().includes(outResSearch.toLowerCase()))
          : resRowsAll;
        const varRows = outVarSearch.trim()
          ? varRowsAll.filter((v) => v.label.toLowerCase().includes(outVarSearch.toLowerCase()))
          : varRowsAll;
        const outEntries: { sourceField: string; targetVar: string }[] = config.outputMapping || [];
        const formRowsAll = (formControls || []).map((fc) => ({
          key: `ofc:${fc.fieldId}`,
          label: fc.name || fc.fieldName,
          fieldType: fc.logicalType || 'text',
          targetFieldId: fc.fieldId || fc.fieldName,
        }));
        const formRows = outVarSearch.trim()
          ? formRowsAll.filter((r) => r.label.toLowerCase().includes(outVarSearch.toLowerCase()))
          : formRowsAll;
        const formEntries: { sourceField: string; targetFieldId: string }[] = config.formOutputMapping || [];
        const effectiveOutMode = formOutputOnly ? 'form' : outMode;
        const activeTargetRows: { key: string; label: string; fieldType: string; targetFieldId?: string }[] = effectiveOutMode === 'vars' ? varRows : formRows;
        const activeEntries: any[] = effectiveOutMode === 'vars' ? outEntries : formEntries;
        // Rows-area coordinates (the svg already starts below the label+search
        // band, so row positions are relative to its top — no OHEADER_H term).
        const oYLeft = (i: number) => i * OPITCH + OROW_H / 2 - outLeftScroll;
        const oYRight = (j: number) => j * OPITCH + OROW_H / 2 - outRightScroll;
        const oConn = (x1: number, y1: number, x2: number, y2: number) =>
          `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.35} ${y1}, ${x1 + (x2 - x1) * 0.65} ${y2}, ${x2} ${y2}`;
        const oPort: React.CSSProperties = {
          position: 'absolute', width: OPORT_R * 2, height: OPORT_R * 2, borderRadius: '50%',
          background: 'var(--sails-primary,#9dcee0)', border: '2px solid var(--sails-bg-card)',
          boxShadow: '0 0 0 1px rgba(157,206,224,.5)', cursor: 'crosshair', zIndex: 3,
        };
        const tryOutMap = (src: { sourceField: string; fieldType: string; name?: string }, tgt: { name: string; fieldType: string; targetFieldId?: string }) => {
          const compat = isCompatibleType(src.fieldType || 'text', tgt.fieldType || 'text');
          setOutDropFeedback({ col: tgt.name, ok: compat });
          if (compat) {
            notifyMapping(null);
            if (effectiveOutMode === 'vars') {
              const entry = { sourceField: src.sourceField, targetVar: tgt.name };
              const existing = outEntries.find((m) => m.targetVar === tgt.name);
              if (!existing) onConfigChange('outputMapping', [...outEntries, entry]);
              else if (existing.sourceField === src.sourceField) onConfigChange('outputMapping', outEntries.filter((m) => m.targetVar !== tgt.name));
              else onConfigChange('outputMapping', outEntries.map((m) => (m.targetVar === tgt.name ? entry : m)));
            } else {
              const tid = tgt.targetFieldId!;
              const entry = { sourceField: src.sourceField, targetFieldId: tid };
              const existing = formEntries.find((m) => m.targetFieldId === tid);
              if (!existing) onConfigChange('formOutputMapping', [...formEntries, entry]);
              else if (existing.sourceField === src.sourceField) onConfigChange('formOutputMapping', formEntries.filter((m) => m.targetFieldId !== tid));
              else onConfigChange('formOutputMapping', formEntries.map((m) => (m.targetFieldId === tid ? entry : m)));
            }
          } else {
            notifyMapping(`Can't assign '${src.sourceField}' (${typeLabel(src.fieldType)}) → ${tgt.name} (${typeLabel(tgt.fieldType)}) — field types are not compatible.`);
          }
        };
        if (op === 'list') {
          return null; // list stores its rows via the Result Variable above
        }
        if (!config.model || modelFields.length === 0) {
          return <p className="ws-props-hint">Select a model in the Action tab first.</p>;
        }
        return (
          <>
            {!formOutputOnly && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {(['vars', 'form'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="sails-btn sails-btn--ghost sails-btn--sm"
                    style={{
                      fontSize: 10,
                      ...(effectiveOutMode === m ? { background: 'rgba(157,206,224,.18)', color: 'var(--sails-primary,#2c7f94)' } : {}),
                    }}
                    onClick={() => { setOutMode(m); setOutClickSrc(null); setOutSelMapIdx(null); }}
                  >{m === 'vars' ? 'To Variables' : 'To Form Controls'}</button>
                ))}
              </div>
            )}
            <div
              ref={outMapRowRef}
              style={{ display: 'flex', position: 'relative' }}
              onClick={() => { setOutSelMapIdx(null); setOutClickSrc(null); }}
              onDragOver={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;
                const cursorY = e.clientY - rect.top - OHEADER_H;
                setOutDragPreview((prev) => (prev ? { ...prev, cx: cursorX, cy: cursorY } : prev));
                const rail = cursorX < rect.width * 0.4 ? outLeftRowsRef : (cursorX > rect.width * 0.6 ? outRightRowsRef : null);
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
              {/* Left — result fields */}
              <div style={{ flex: '0 0 calc(40% + 20px)', minWidth: 0 }}>
                <div style={{ height: OLABEL_H, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <label className="ws-props-label" style={{ margin: 0 }}>Result Fields ({modelTable?.name || ''})</label>
                </div>
                <div className="wvp-search" style={{ boxSizing: 'border-box', height: OSEARCH_H, marginBottom: 0 }}>
                  <Search size={11} />
                  <input
                    className="wvp-search-input"
                    placeholder="Search result fields…"
                    value={outResSearch}
                    onChange={(e) => setOutResSearch(e.target.value)}
                  />
                </div>
                <div
                  ref={outLeftRowsRef}
                  style={{ maxHeight: OROWS_MAX, overflowY: 'auto', overflowX: 'hidden', paddingRight: 20 }}
                  onScroll={(e) => setOutLeftScroll(e.currentTarget.scrollTop)}
                >
                  {resRows.map((f, i) => (
                    <div
                      key={f.key}
                      className={`wvp-node ${outClickSrc?.sourceField === f.sourceField ? 'wvp-node--selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOutClickSrc({ sourceField: f.sourceField, fieldType: f.fieldType, name: f.label });
                        setOutSelMapIdx(null);
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        // Keep the ghost glued to the grab point — the default
                        // anchors it top-left, which makes the drop drift.
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, e.clientX - rect.left, e.clientY - rect.top);
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'out-map', sourceField: f.sourceField, fieldType: f.fieldType, name: f.label, rowIndex: i }));
                        e.dataTransfer.effectAllowed = 'copy';
                        setOutDragPreview({ srcIndex: i, tgtIndex: -1, ok: false, cx: osrcX, cy: oYLeft(i) });
                      }}
                      onDragEnd={() => setOutDragPreview(null)}
                      title={`Type: ${typeLabel(f.fieldType)} — drag to a variable, or click then a variable`}
                      style={{
                        position: 'relative', height: OROW_H, marginTop: 0, marginBottom: OGAP, boxSizing: 'border-box', width: '100%', gap: 4,
                      }}
                    >
                      <span className="wvp-node__icon" style={{ color: typeColor(f.fieldType) }}>
                        {(() => { const I = typeIcon(f.fieldType); return <I size={11} />; })()}
                      </span>
                      <span className="wvp-node__label">{f.label}</span>
                      <span className="wvp-node__type">{typeLabel(f.fieldType)}</span>
                      <span className="ws-map-port" style={{ ...oPort, right: 2, top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle — drag & drop gap */}
              <div style={{ flex: '0 0 calc(20% - 20px)' }} />

              {/* Right — variables or form controls */}
              <div style={{ flex: '0 0 40%', minWidth: 0 }}>
                <div style={{ height: OLABEL_H, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <label className="ws-props-label" style={{ margin: 0 }}>{effectiveOutMode === 'vars' ? 'Variables' : 'Form Controls'}</label>
                </div>
                <div className="wvp-search" style={{ boxSizing: 'border-box', height: OSEARCH_H, marginBottom: 0 }}>
                  <Search size={11} />
                  <input
                    className="wvp-search-input"
                    placeholder={effectiveOutMode === 'vars' ? 'Search variables…' : 'Search form controls…'}
                    value={outVarSearch}
                    onChange={(e) => setOutVarSearch(e.target.value)}
                  />
                </div>
                <div
                  ref={outRightRowsRef}
                  style={{ maxHeight: OROWS_MAX, overflowY: 'auto', overflowX: 'hidden' }}
                  onScroll={(e) => setOutRightScroll(e.currentTarget.scrollTop)}
                >
                  {activeTargetRows.map((v, j) => {
                    const mapped = activeEntries.some((m) => effectiveOutMode === 'vars' ? m.targetVar === v.label : m.targetFieldId === v.targetFieldId);
                    const feedback = outDropFeedback !== null && outDropFeedback.col === v.label;
                    const feedbackOk = feedback && outDropFeedback.ok;
                    // The whole row accepts the drop — no pixel-perfect port hits.
                    return (
                      <div key={v.key} className="wvp-node"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (outClickSrc) tryOutMap(outClickSrc, { name: v.label, fieldType: v.fieldType, targetFieldId: v.targetFieldId });
                          else if (mapped) {
                            if (effectiveOutMode === 'vars') onConfigChange('outputMapping', outEntries.filter((m) => m.targetVar !== v.label));
                            else onConfigChange('formOutputMapping', formEntries.filter((m) => m.targetFieldId !== v.targetFieldId));
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                          const ok = isCompatibleType(
                            (() => { try { return JSON.parse(e.dataTransfer.getData('application/json')).fieldType || ''; } catch { return ''; } })(),
                            v.fieldType,
                          );
                          setOutDragPreview((prev) => (prev ? { ...prev, tgtIndex: j, ok } : prev));
                          setOutDropFeedback({ col: v.label, ok });
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          e.preventDefault(); e.stopPropagation();
                          setOutDragPreview((prev) => (prev ? { ...prev, tgtIndex: -1 } : prev));
                          setOutDropFeedback(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          setOutDragPreview(null);
                          try {
                            const p = JSON.parse(e.dataTransfer.getData('application/json'));
                            if (p.type !== 'out-map') return;
                            tryOutMap(p, { name: v.label, fieldType: v.fieldType, targetFieldId: v.targetFieldId });
                          } catch { /* ignore */ }
                        }}
                        style={{
                          position: 'relative', height: OROW_H, marginTop: 0, marginBottom: OGAP, boxSizing: 'border-box', width: '100%', gap: 4,
                          background: mapped ? 'rgba(59,130,246,.08)' : (feedback ? (feedbackOk ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)') : undefined),
                          borderRadius: 4,
                        }}
                      >
                        {/* Visual port marker (the row itself is the drop zone) */}
                        <span
                          className="ws-map-port"
                          style={{ ...oPort, left: 2, top: '50%', transform: 'translateY(-50%)' }}
                          title={mapped ? 'Drop to unmap' : `Drop to assign → ${v.label}`}
                        />
                        <span className="wvp-node__icon" style={{ color: typeColor(v.fieldType) }}>
                          {(() => { const I = typeIcon(v.fieldType); return <I size={11} />; })()}
                        </span>
                        <span className="wvp-node__label">{v.label}</span>
                        <span className="wvp-node__type">{typeLabel(v.fieldType)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connector layer */}
              <svg style={{ position: 'absolute', left: 0, top: OHEADER_H, width: '100%', height: `calc(100% - ${OHEADER_H}px)`, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                {activeEntries.map((m, mi) => {
                  const si = resRows.findIndex((f) => f.sourceField === m.sourceField);
                  const ti = activeTargetRows.findIndex((v) => effectiveOutMode === 'vars' ? v.label === m.targetVar : v.targetFieldId === m.targetFieldId);
                  if (si < 0 || ti < 0) return null;
                  const tgtName = effectiveOutMode === 'vars' ? m.targetVar : (activeTargetRows[ti]?.label || m.targetFieldId);
                  const sel = outSelMapIdx === mi;
                  return (
                    <g key={mi}>
                      <title>{sel ? `${m.sourceField} → ${tgtName} (click again or press Delete to remove)` : `${m.sourceField} → ${tgtName} (click to select)`}</title>
                      <path
                        d={oConn(osrcX, oYLeft(si), otgtX, oYRight(ti))}
                        stroke={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'}
                        strokeWidth={sel ? 3 : 2}
                        fill="none"
                        strokeLinecap="round"
                        style={{ pointerEvents: 'visiblePainted', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); setOutSelMapIdx(sel ? null : mi); }}
                      />
                      <circle cx={otgtX} cy={oYRight(ti)} r={sel ? 4.5 : 3.5} fill={sel ? '#ef4444' : 'var(--sails-primary,#9dcee0)'} style={{ pointerEvents: 'visiblePainted' }} onClick={(e) => { e.stopPropagation(); setOutSelMapIdx(sel ? null : mi); }} />
                    </g>
                  );
                })}
                {outDragPreview && (
                  <path
                    d={
                      outDragPreview.tgtIndex >= 0
                        ? oConn(osrcX, oYLeft(outDragPreview.srcIndex), otgtX, oYRight(outDragPreview.tgtIndex))
                        : oConn(osrcX, oYLeft(outDragPreview.srcIndex), Math.min(Math.max(outDragPreview.cx, osrcX), otgtX), outDragPreview.cy)
                    }
                    stroke={outDragPreview.tgtIndex >= 0 ? (outDragPreview.ok ? '#10b981' : '#ef4444') : 'var(--sails-primary,#9dcee0)'}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="none"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                )}
              </svg>
            </div>
            {outSelMapIdx !== null && activeEntries[outSelMapIdx] && (
              <p className="ws-props-hint" style={{ padding: '4px 0 0', color: '#ef4444' }}>
                Line selected — press Delete/Backspace to remove
              </p>
            )}
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
        if (p.name === 'channel') {
          // Email ⇄ Bell delivery toggle — each channel has its own recipients panel.
          const current = String(value ?? p.defaultValue ?? 'bell');
          return (
            <div className="ws-wiz-toggle" role="group" aria-label="Delivery channel">
              {(p.options || []).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ws-wiz-toggle__opt${current === o.value ? ' ws-wiz-toggle__opt--active' : ''}`}
                  onClick={() => setParam(p.name, o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          );
        }
        return (
          <select className="ws-props-input" value={value ?? p.defaultValue ?? ''} onChange={(e) => setParam(p.name, e.target.value)}>
            {(p.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'boolean':
        if (eventType === 'approval' && p.name === 'notifyEmail') {
          // "Send to Email" / "Send to Bell" — row of two checkboxes (standard size).
          return (
            <div className="ws-props-check-row">
              {[{ name: 'notifyEmail', label: 'Send to Email' }, { name: 'notifyBell', label: 'Send to Bell' }].map((o) => (
                <label key={o.name}>
                  <input type="checkbox" checked={config[o.name] !== false} onChange={(e) => setParam(o.name, e.target.checked)} /> {o.label}
                </label>
              ))}
            </div>
          );
        }
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
          <SailsHtmlEditor
            value={value ?? ''}
            variables={variables}
            recordSchemas={recordSchemas}
            recordSchema={recordSchema}
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
        if (p.name === 'emailRecipients' || p.name === 'emailCc' || p.name === 'emailBcc' || p.name === 'bellRecipients') {
          // Per-channel recipients via the standard variable-aware text input
          // (chips, {{ intellisense, … picker, drag, ƒ expression).
          const isBell = p.name === 'bellRecipients';
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
              onAddVariable={onAddVariable}
              placeholder={isBell ? 'user:ID, role:name or {{variable}}' : (p.placeholder || 'name@example.com or {{variable}}')}
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
              onAddVariable={onAddVariable}
              placeholder="Subject — type {{ to reference variables…"
            />
          );
        }
        return <input className="ws-props-input" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} />;
      default:
        return <input className="ws-props-input" value={value ?? ''} placeholder={p.placeholder} onChange={(e) => setParam(p.name, e.target.value)} />;
    }
  };

  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal ws-qstudio-modal" onClick={(e) => e.stopPropagation()} style={{ width: 760, height: 'min(640px, 90vh)' }}>
        <div className="ws-wizard-toast-host">
          <UiToast message={mapToast} tone="error" />
        </div>
        <div className="ws-modal__header">
          <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Database size={16} /></span>
          <div className="ws-modal__titles">
            <span className="ws-modal__title">{config.operation ? (OPERATION_LABELS[op] || 'Workflow Event') : 'Workflow Event'} Configuration</span>
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
              // Task Approval — last tab "Exit": the shared Exit Conditions editor.
              if (eventType === 'approval' && currentTab === tabs.length - 1) {
                if (!exitConditions) {
                  return <p className="ws-props-hint" style={{ padding: 12 }}>Exit conditions are configured in the Workflow Studio stage properties.</p>;
                }
                return (
                  <ExitConditionsEditor
                    lines={exitConditions.lines}
                    actions={exitConditions.actions}
                    stageNames={exitConditions.stageNames}
                    disabled={exitConditions.disabled}
                    expression={exitConditions.expression}
                    onAdd={exitConditions.onAdd}
                    onUpdate={exitConditions.onUpdate}
                    onRemove={exitConditions.onRemove}
                  />
                );
              }
              const opParam = stepParams.find((p) => p.type === 'operation_select');
              const filterParam = stepParams.find((p) => p.type === 'filter_builder');
              const targetTypeParam = stepParams.find((p) => p.name === 'targetType');
              const targetValueParam = stepParams.find((p) => p.name === 'targetValue');
              const channel = String(config.channel || 'bell');
              // Channel-based recipient visibility applies ONLY to the
              // Notification event (it has a channel toggle). Task Approval
              // has no channel — its Email/Bell delivery is gated by the
              // notifyEmail/notifyBell checkboxes instead.
              const notifChannelGate = eventType === 'notification';
              const others = stepParams.filter((p) => {
                if (notifChannelGate && p.name === 'emailRecipients' && channel !== 'email') return false;
                if (notifChannelGate && (p.name === 'emailCc' || p.name === 'emailBcc') && channel !== 'email') return false;
                if (notifChannelGate && p.name === 'bellRecipients' && channel !== 'bell') return false;
                // Approval: the Delivery row (notifyEmail) already renders
                // both checkboxes — hide the duplicate notifyBell param.
                if (eventType === 'approval' && p.name === 'notifyBell') return false;
                return p !== opParam && p !== filterParam && p !== targetTypeParam && p !== targetValueParam;
              });
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
                    <>
                      <div className="ws-props-group">
                        <label className="ws-props-label">{opParam.label}</label>
                        {renderParam(opParam)}
                      </div>
                      <div className="ws-props-group">
                        <label className="ws-props-label">Filter</label>
                        <button
                          type="button"
                          className="ws-props-input"
                          disabled={!canFilter || !hasValidModel}
                          style={{ width: 'auto', minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: canFilter && hasValidModel ? 'pointer' : 'not-allowed', opacity: canFilter && hasValidModel ? 1 : 0.55, whiteSpace: 'nowrap' }}
                          onClick={() => canFilter && hasValidModel && onOpenFilterBuilder(eventId)}
                          title={!hasValidModel ? 'Select a target model to build a filter' : canFilter ? 'Build a filter with QueryStudio' : 'Available for Read / List operations'}
                        >
                          <Filter size={12} />
                          {(() => {
                            const n = (config.filterGroups || []).reduce((acc: number, g: any) => acc + (g.rules?.length || 0), 0);
                            return n > 0 ? `${n} rule${n > 1 ? 's' : ''}` : 'Filter';
                          })()}
                        </button>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
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
