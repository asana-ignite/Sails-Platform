/**
 * Workflow Studio — Three-panel workflow builder (mirrors Layout Studio).
 *
 * Route: /workflow-studio/:workflowId
 *   Left  = Palette (stages, events, variables)
 *   Center = Canvas (DAG with SVG orthogonal edges, 4-port connections)
 *   Right = Properties (contextual: stage / event / branch / workflow)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, X, Trash2, GitBranch, User, Users,
  Briefcase, Shield, Hash, Clock, Settings, Filter,
  Database, Bell, ClipboardCheck, Code2, Workflow, Zap,
  Link2, Split, CheckCircle2, AlertTriangle,
  Layers, ChevronsUpDown, Braces, MousePointer2,
  CornerUpLeft, Unlink, History, RotateCcw, Maximize2, Minimize2,
  Pencil, Save, Play, Wand2, Globe, ArrowRight,
} from 'lucide-react';
import ExpressionEditor from '../__mockups__/ExpressionEditor';
import { CustomSelect } from '../../components/common/CustomSelect';
import { FilterBuilder } from '../../components/common/FilterBuilder';
import type { FilterGroup, SailsTableDefinition } from '@sails/shared';
import { fetchCached } from '../../api/client';
import jsonata from 'jsonata';
import { useAuth } from '../../contexts/AuthContext';
import Unauthorized from '../Unauthorized';
import LoadingScreen from '../../components/common/LoadingScreen';
import './WorkflowStudio.css';

// ─── Types ────────────────────────────────────────────────────

type WorkflowEventType = 'record' | 'notification' | 'approval' | 'expression' | 'transform' | 'script';
type RouterType = 'user' | 'team' | 'position' | 'role' | 'field';
type LayoutMode = 'chain' | 'canvas';
type Port = 'top' | 'right' | 'bottom' | 'left';
type Timing = 'stage_enter' | 'stage_exit';

interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  label: string;
  timing?: Timing;
  config: Record<string, any>;
}

interface WorkflowVariable {
  id: string;
  name: string;
  fieldType: string;
  defaultValue?: any;
}

interface BranchCondition {
  id: string;
  label: string;
  expression: string;
  targetType: 'stage' | 'completed';
  targetStageId?: string;
  fromPort?: Port;
  toPort?: Port;
}

interface RouteStage {
  id: string;
  name: string;
  x: number;
  y: number;
  routerType: RouterType;
  routerValue: string;
  routerLabel: string;
  canApprove: boolean;
  canReject: boolean;
  canComment: boolean;
  canReassign: boolean;
  timeoutHours: number | null;
  entryCondition: string;
  events: WorkflowEvent[];
  branches: BranchCondition[];
}

interface RoutingProcess {
  name: string;
  description: string;
  tableId: string | null;
  triggerOn: string[];
  triggerCondition: FilterGroup[];
  startMode: StartMode;
  restConfig: RestTriggerConfig;
  scheduleConfig: ScheduleTriggerConfig;
  variables: WorkflowVariable[];
  /** Events fired when the workflow starts (Start node). */
  startEvents: WorkflowEvent[];
  /** Explicit routing paths from the Start node. Empty = no start edge. */
  startBranches: BranchCondition[];
  stages: RouteStage[];
}

type StartMode = 'record' | 'rest' | 'scheduled';

interface RestTriggerConfig {
  path: string;
  method: string;
  headers: string;
  authToken: string;
  payloadExample: string;
}

interface ScheduleTriggerConfig {
  preset: 'hourly' | 'daily' | 'custom';
  cron: string;
  timezone: string;
}

interface WorkflowDef {
  id: string;
  tenantId: string;
  name: string;
  systemName: string;
  description: string | null;
  tableId: string | null;
  status: string;
  currentVersion: number;
  config: any;
  publishedConfig: any;
  versions?: WorkflowVersionRow[];
}

interface WorkflowVersionRow {
  id: string;
  defId: string;
  version: number;
  config: any;
  notes: string | null;
  publishedBy: string | null;
  publishedAt: string;
}

interface Pt { x: number; y: number; }

// ─── Constants ────────────────────────────────────────────────

const NODE_W = 230;
const NODE_H = 116;
const START_W = NODE_W;
const START_H = 56;
const START_CHIP_H = 26;
const CHAIN_X = 360;
const CHAIN_SPACING = 180;
const ROUTE_STUB = 26;
const CORNER_RADIUS = 10;
const GRID = 20;
const ALL_PORTS: Port[] = ['top', 'right', 'bottom', 'left'];

const PORT_DIR: Record<Port, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const ROUTER_TYPES: { type: RouterType; label: string; icon: React.ReactNode }[] = [
  { type: 'user', label: 'Specific User', icon: <User size={12} /> },
  { type: 'team', label: 'Team', icon: <Users size={12} /> },
  { type: 'position', label: 'Position', icon: <Briefcase size={12} /> },
  { type: 'role', label: 'Role', icon: <Shield size={12} /> },
  { type: 'field', label: 'Record Field', icon: <Hash size={12} /> },
];

const EVENT_DEFS: { type: WorkflowEventType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { type: 'record', label: 'Record Event', desc: 'CRUD on a model', icon: <Database size={13} />, color: '#3b82f6' },
  { type: 'notification', label: 'Notification', desc: 'Bell / Email', icon: <Bell size={13} />, color: '#f59e0b' },
  { type: 'approval', label: 'Task Approval', desc: 'Assign approver', icon: <ClipboardCheck size={13} />, color: '#10b981' },
  { type: 'expression', label: 'Expression', desc: 'JSONata compute', icon: <Code2 size={13} />, color: '#a855f7' },
  { type: 'transform', label: 'Transform', desc: 'JSONata mapping', icon: <Braces size={13} />, color: '#0ea5e5' },
  { type: 'script', label: 'Script Event', desc: 'BYOC sandbox', icon: <Workflow size={13} />, color: '#8b5cf6' },
];

const FIELD_TYPES = [
  'short_text', 'long_text', 'rich_text', 'number', 'decimal', 'currency',
  'percentage', 'boolean', 'date', 'datetime', 'time', 'select', 'relation',
  'user', 'phone', 'email', 'auto_number',
];

const TRIGGER_OPS: { value: string; label: string; desc: string }[] = [
  { value: 'insert', label: 'Inserted', desc: 'Starts when a new record is created.' },
  { value: 'update', label: 'Updated', desc: 'Starts when an existing record changes.' },
  { value: 'insert_or_update', label: 'Inserted Or Updated', desc: 'Starts on both create and update.' },
  { value: 'delete', label: 'Deleted', desc: 'Starts when a record is removed.' },
];

/** Normalize legacy triggerOn arrays (create/update checkboxes) to a single op token. */
function triggerOpOf(list: string[]): string {
  const has = (t: string) => list.includes(t);
  if (has('insert_or_update') || (has('create') && has('update'))) return 'insert_or_update';
  if (has('delete')) return 'delete';
  if (has('insert') || has('create')) return 'insert';
  if (has('update')) return 'update';
  return 'insert_or_update';
}

/** Rule count across all trigger condition groups. */
function triggerRuleCount(groups: FilterGroup[]): number {
  return groups.reduce((n, g) => n + g.rules.length, 0);
}

let _counter = 0;
function genId(prefix: string): string { _counter++; return `${prefix}_${Date.now().toString(36)}_${_counter}`; }

// ─── Factories ────────────────────────────────────────────────

function newEvent(type: WorkflowEventType): WorkflowEvent {
  const id = genId('ev');
  switch (type) {
    case 'record': return { id, type, label: 'Record Event', config: { model: 'Contracts', operation: 'read', storeToVariable: '' } };
    case 'notification': return { id, type, label: 'Notification', config: { channel: 'bell', recipients: '', subject: '', message: '' } };
    case 'approval': return { id, type, label: 'Task Approval', config: { routerType: 'role', routerValue: '', routerLabel: 'Approver', canApprove: true, canReject: true, timeoutHours: null } };
    case 'expression': return { id, type, label: 'Expression', config: { expression: '', assignToVariable: '' } };
    case 'transform': return { id, type, label: 'Transform', config: { expression: '', assignToVariable: '' } };
    case 'script': return { id, type, label: 'Script', config: { scriptId: '', scriptName: '', timeoutMs: 5000 } };
  }
}

function newStage(name: string, x: number, y: number): RouteStage {
  return {
    id: genId('st'), name, x, y,
    routerType: 'team', routerValue: '', routerLabel: '',
    canApprove: true, canReject: true, canComment: true, canReassign: false,
    timeoutHours: null, entryCondition: '', events: [], branches: [],
  };
}

function newBranch(): BranchCondition {
  return { id: genId('br'), label: 'New Branch', expression: '', targetType: 'completed' };
}

function newVariable(): WorkflowVariable {
  return { id: genId('var'), name: '', fieldType: 'short_text' };
}

function emptyProcess(): RoutingProcess {
  return {
    name: '', description: '', tableId: null, triggerOn: [], triggerCondition: [], startMode: 'record',
    restConfig: { path: '', method: 'POST', headers: '', authToken: '', payloadExample: '' },
    scheduleConfig: { preset: 'custom', cron: '', timezone: 'UTC' },
    variables: [], startEvents: [], startBranches: [], stages: [],
  };
}

// ─── Geometry ─────────────────────────────────────────────────

function portPos(p: Pt, port: Port, w = NODE_W, h = NODE_H): Pt {
  switch (port) {
    case 'top': return { x: p.x + w / 2, y: p.y };
    case 'right': return { x: p.x + w, y: p.y + h / 2 };
    case 'bottom': return { x: p.x + w / 2, y: p.y + h };
    case 'left': return { x: p.x, y: p.y + h / 2 };
  }
}

function orthogonalPoints(a: Pt, b: Pt, fromPort: Port, toPort: Port, aW = NODE_W, aH = NODE_H, bW = NODE_W, bH = NODE_H): Pt[] {
  const s = portPos(a, fromPort, aW, aH);
  const e = portPos(b, toPort, bW, bH);
  const ds = PORT_DIR[fromPort];
  const de = PORT_DIR[toPort];
  const s1 = { x: s.x + ds.x * ROUTE_STUB, y: s.y + ds.y * ROUTE_STUB };
  const e1 = { x: e.x + de.x * ROUTE_STUB, y: e.y + de.y * ROUTE_STUB };
  const sH = ds.x !== 0;
  const eH = de.x !== 0;
  let pts: Pt[];
  if (sH && eH) {
    const along = Math.abs(s1.x - e1.x);
    const tol = Math.max(ROUTE_STUB, along / 4);
    if (Math.abs(s1.y - e1.y) < tol) pts = [s, s1, e1, e];
    else { const midY = (s1.y + e1.y) / 2; pts = [s, s1, { x: s1.x, y: midY }, { x: e1.x, y: midY }, e1, e]; }
  } else if (!sH && !eH) {
    const along = Math.abs(s1.y - e1.y);
    const tol = Math.max(ROUTE_STUB, along / 4);
    if (Math.abs(s1.x - e1.x) < tol) pts = [s, s1, e1, e];
    else { const midX = (s1.x + e1.x) / 2; pts = [s, s1, { x: midX, y: s1.y }, { x: midX, y: e1.y }, e1, e]; }
  } else if (sH) {
    pts = [s, s1, { x: e1.x, y: s1.y }, e1, e];
  } else {
    pts = [s, s1, { x: s1.x, y: e1.y }, e1, e];
  }
  const out: Pt[] = [];
  for (const p of pts) { const last = out[out.length - 1]; if (!last || last.x !== p.x || last.y !== p.y) out.push(p); }
  return out;
}

function roundedOrthogonalPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
    const lenIn = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    const lenOut = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
    const r = Math.max(0, Math.min(CORNER_RADIUS, lenIn / 2, lenOut / 2));
    if (r === 0) { d += ` L ${cur.x} ${cur.y}`; continue; }
    const dx1 = Math.sign(cur.x - prev.x) || 0, dy1 = Math.sign(cur.y - prev.y) || 0;
    const dx2 = Math.sign(next.x - cur.x) || 0, dy2 = Math.sign(next.y - cur.y) || 0;
    d += ` L ${cur.x - dx1 * r} ${cur.y - dy1 * r} Q ${cur.x} ${cur.y}, ${cur.x + dx2 * r} ${cur.y + dy2 * r}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

function edgeMidpoint(a: Pt, b: Pt, fromPort: Port = 'bottom', toPort: Port = 'top', aW = NODE_W, aH = NODE_H, bW = NODE_W, bH = NODE_H): Pt {
  const pts = orthogonalPoints(a, b, fromPort, toPort, aW, aH, bW, bH);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  let target = total / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (target <= len || i === pts.length - 2) {
      const t = len === 0 ? 0 : target / len;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    target -= len;
  }
  return pts[pts.length - 1];
}

function defaultPorts(a: Pt, b: Pt): { fromPort: Port; toPort: Port } {
  if (b.y > a.y + 40) return { fromPort: 'bottom', toPort: 'top' };
  if (b.y < a.y - 40) return { fromPort: 'top', toPort: 'bottom' };
  if (b.x >= a.x) return { fromPort: 'right', toPort: 'left' };
  return { fromPort: 'left', toPort: 'right' };
}

function nearestPort(nodePos: Pt, pos: Pt): Port {
  let best: Port = 'top', bestD = Infinity;
  ALL_PORTS.forEach((p) => {
    const pp = portPos(nodePos, p);
    const d = (pp.x - pos.x) ** 2 + (pp.y - pos.y) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  });
  return best;
}

// ─── Component ────────────────────────────────────────────────

export const WorkflowStudio: React.FC = () => {
  const { user } = useAuth();
  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN'];

  // URL param
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  // Workflow definition
  const [def, setDef] = useState<WorkflowDef | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionRow[]>([]);

  // Process (canvas data)
  const [process, setProcess] = useState<RoutingProcess>(emptyProcess);

  // Selection
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState(false);

  // Mode
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('chain');

  // Canvas
  const [startPos, setStartPos] = useState<Pt>({ x: 40, y: 160 });
  const [dragging, setDragging] = useState<{ id: string; kind: 'stage' | 'start'; dx: number; dy: number } | null>(null);
  // Canvas viewport: zoom level, background pan state, and custom canvas size
  // (canvasH null = auto-fit to content).
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [canvasW, setCanvasW] = useState(1400);
  const [canvasH, setCanvasH] = useState<number | null>(null);
  const [sizePopoverOpen, setSizePopoverOpen] = useState(false);
  const [sizeDraft, setSizeDraft] = useState({ w: '1400', h: '' });
  const [connectFrom, setConnectFrom] = useState<{ stageId: string; port: Port } | null>(null);
  const [connectPos, setConnectPos] = useState<Pt | null>(null);
  const [draggingEdgePort, setDraggingEdgePort] = useState<{ branchId: string; side: 'from' | 'to' } | null>(null);
  const [dragPaletteType, setDragPaletteType] = useState<WorkflowEventType | null>(null);

  // Panels
  const [paletteWidth, setPaletteWidth] = useState(240);
  const [propsWidth, setPropsWidth] = useState(320);
  const [paletteFloating, setPaletteFloating] = useState(false);
  const [propsFloating, setPropsFloating] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [propsVisible, setPropsVisible] = useState(true);
  const [paletteResizing, setPaletteResizing] = useState(false);
  const [propsResizing, setPropsResizing] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  // API / UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [exprModalEventId, setExprModalEventId] = useState<string | null>(null);
  const [editingNewVar, setEditingNewVar] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('short_text');
  const [startConditionOpen, setStartConditionOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [recordFilterEventId, setRecordFilterEventId] = useState<string | null>(null);
  const [eventModalEventId, setEventModalEventId] = useState<string | null>(null);
  const [tables, setTables] = useState<SailsTableDefinition[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchCached('/api/metadata/objects', undefined, 60000)
      .then((data: any) => {
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
        setTables(rows);
      })
      .catch(() => { if (mounted) setTables([]); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTable = tables.find((t) => t.id === process.tableId) || null;
  const modelOptions = tables.map((t) => ({ value: t.id, label: t.name, icon: <Database size={13} /> }));

  const worldRef = useRef<HTMLDivElement | null>(null);
  // Simple-mode drag-reorder state: origin (original index + pointer world Y at
  // drag start) and the live pointer world Y — the dragged card glides with it.
  const chainDragRef = useRef<{ stageId: string; startIdx: number; startWorldY: number; grabOffsetWorld: number } | null>(null);
  const [chainDragY, setChainDragY] = useState<number | null>(null);

  // Derived
  const selectedStage = process.stages.find((s) => s.id === selectedStageId) || null;
  const selectedEvent = selectedStage
    ? selectedStage.events.find((e) => e.id === selectedEventId) || null
    : selectedStart
      ? process.startEvents.find((e) => e.id === selectedEventId) || null
      : null;
  const exprModalEvent = selectedStage && exprModalEventId
    ? selectedStage.events.find((e) => e.id === exprModalEventId) || null
    : selectedStart && exprModalEventId
      ? process.startEvents.find((e) => e.id === exprModalEventId) || null
      : null;

  const stagePos = (idx: number, s: RouteStage): Pt =>
    layoutMode === 'chain' ? { x: CHAIN_X, y: START_H + 100 + idx * CHAIN_SPACING } : { x: s.x, y: s.y };

  const startNodePos: Pt = layoutMode === 'chain'
    ? { x: CHAIN_X, y: 20 }
    : startPos;
  const startNodeH = START_H + (process.startEvents.length > 0 ? START_CHIP_H : 0);

  const worldW = canvasW;
  const worldH = layoutMode === 'chain'
    ? Math.max(300, START_H + 100 + (process.stages.length - 1) * CHAIN_SPACING + NODE_H + 120)
    : canvasH ?? Math.max(820, startNodePos.y + startNodeH + 80, ...process.stages.map((s) => s.y + NODE_H + 160));

  // Edges
  const edges = useMemo(() => {
    type Edge = { id: string; a: Pt; b: Pt; label: string; kind: 'start' | 'branch'; fromPort: Port; toPort: Port; branchId?: string; sourceStageId?: string };
    const out: Edge[] = [];
    process.startBranches.forEach((br) => {
      if (br.targetType === 'completed') return;
      const tIdx = process.stages.findIndex((st) => st.id === br.targetStageId);
      if (tIdx === -1) return;
      const tb = stagePos(tIdx, process.stages[tIdx]);
      const dp = defaultPorts(startNodePos, tb);
      out.push({ id: br.id, a: startNodePos, b: tb, label: br.label, kind: 'start', fromPort: br.fromPort || dp.fromPort, toPort: br.toPort || dp.toPort, branchId: br.id });
    });
    process.stages.forEach((s, idx) => {
      const a = stagePos(idx, s);
      s.branches.forEach((br) => {
        // A branch targeting Completed draws no edge — no next path means the flow completes.
        if (br.targetType === 'completed') return;
        const tIdx = process.stages.findIndex((st) => st.id === br.targetStageId);
        if (tIdx === -1) return;
        const tb = stagePos(tIdx, process.stages[tIdx]);
        const dp = defaultPorts(a, tb);
        out.push({ id: br.id, a, b: tb, label: br.label, kind: 'branch', fromPort: br.fromPort || dp.fromPort, toPort: br.toPort || dp.toPort, branchId: br.id, sourceStageId: s.id });
      });
    });
    return out;
  }, [process, layoutMode, startNodePos]);

  // ── Parse URL param ──
  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split('/');
    const idIdx = parts.indexOf('workflow-studio');
    if (idIdx >= 0 && parts[idIdx + 1]) setWorkflowId(parts[idIdx + 1]);
  }, []);

  // ── Load workflow ──
  useEffect(() => {
    if (!workflowId) return;
    setLoading(true);
    fetch(`/api/workflows?id=${encodeURIComponent(workflowId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) { setError(json.error || 'Failed to load'); return; }
        const d: WorkflowDef = json.data;
        setDef(d);
        setVersions(d.versions || []);
        const source = d.status === 'active' ? (d.publishedConfig || d.config) : d.config;
        if (source?.stages) {
          setProcess({
            name: d.name, description: d.description || '', tableId: d.tableId || null,
            triggerOn: source.triggerOn || [],
            triggerCondition: source.triggerCondition || [],
            startMode: source.startMode || 'record',
            restConfig: { path: '', method: 'POST', headers: '', authToken: '', payloadExample: '', ...(source.restConfig || {}) },
            scheduleConfig: { preset: 'custom', cron: '', timezone: 'UTC', ...(source.scheduleConfig || {}) },
            variables: source.variables || [],
            startEvents: source.startEvents || [],
            startBranches: source.startBranches || [],
            stages: source.stages || [],
          });
        } else {
          setProcess((p) => ({ ...p, name: d.name, description: d.description || '', tableId: d.tableId || null } as any));
        }
      }).catch((e) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [workflowId]);

  // ── Keyboard ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (editingLabelId) return;
      e.preventDefault();
      if (selectedEdgeId) {
        const owner = process.stages.find((st) => st.branches.some((b) => b.id === selectedEdgeId));
        if (owner) { removeBranch(owner.id, selectedEdgeId); setSelectedEdgeId(null); }
        else if (process.startBranches.some((b) => b.id === selectedEdgeId)) { removeStartBranch(selectedEdgeId); }
        return;
      }
      if (selectedEventId && selectedStart) { removeStartEvent(selectedEventId); return; }
      if (selectedEventId && selectedStageId) { removeEvent(selectedStageId, selectedEventId); return; }
      if (selectedStageId) removeStage(selectedStageId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line
  }, [selectedStageId, selectedEventId, selectedEdgeId, selectedStart, editingLabelId, process]);

  // ── Panel resize ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (paletteResizing) {
        const w = Math.max(180, Math.min(400, e.clientX));
        if (w < 190) setPaletteCollapsed(true);
        else { setPaletteCollapsed(false); setPaletteWidth(w); }
      }
      if (propsResizing) {
        const w = Math.max(220, Math.min(500, window.innerWidth - e.clientX));
        setPropsWidth(w);
      }
    };
    const onUp = () => { setPaletteResizing(false); setPropsResizing(false); };
    if (paletteResizing || propsResizing) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }
    // eslint-disable-next-line
  }, [paletteResizing, propsResizing]);

  // ── Toast auto-dismiss ──
  useEffect(() => { if (savedMsg) { const t = setTimeout(() => setSavedMsg(null), 3000); return () => clearTimeout(t); } }, [savedMsg]);

  // Ctrl + wheel over the canvas zooms in/out (native listener — React wheel
  // handlers are passive and cannot preventDefault).
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.min(3, Math.max(0.2, +(z * factor).toFixed(3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Stage ops ──
  const updateStage = (stageId: string, patch: Partial<RouteStage>) => { setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) })); };

  /**
   * Auto-arrange the workflow on the canvas: layered DAG layout (longest-path
   * layering from the Start node). Layers flow left → right; stages within a
   * layer stack vertically; the Start node sits centered left of layer 0.
   */
  const doAutoLayout = () => {
    const H_GAP = 40;          // horizontal gap between stages in a layer row
    const LAYER_GAP = 90;      // vertical gap between layers (flow goes downward)
    const START_Y = 40;
    const GRID = 20;
    const snap = (v: number) => Math.round(v / GRID) * GRID;

    // 1. Longest-path layering from the Start node.
    const layerOf = new Map<string, number>();
    const visit = (stageId: string, depth: number) => {
      if (depth > 500) return; // cycle guard — the flow should be a DAG
      if ((layerOf.get(stageId) ?? -1) >= depth) return;
      layerOf.set(stageId, depth);
      const st = process.stages.find((s) => s.id === stageId);
      for (const br of st?.branches || []) {
        if (br.targetType === 'stage' && br.targetStageId) visit(br.targetStageId, depth + 1);
      }
    };
    for (const br of process.startBranches) {
      if (br.targetType === 'stage' && br.targetStageId) visit(br.targetStageId, 0);
    }
    // Unreachable stages (no incoming path) get their own sink layers at the end.
    const maxL = Math.max(0, ...layerOf.values());
    let sink = maxL + 1;
    for (const st of process.stages) {
      if (!layerOf.has(st.id)) { layerOf.set(st.id, sink); sink += 1; }
    }

    // 2. Group stages by layer.
    const layers = new Map<number, RouteStage[]>();
    for (const st of process.stages) {
      const l = layerOf.get(st.id) ?? 0;
      if (!layers.has(l)) layers.set(l, []);
      layers.get(l)!.push(st);
    }

    // 3. Position layers top → bottom; stages in a layer sit side by side,
    //    each layer row centered on the canvas.
    const layerYs = [...layers.keys()].sort((a, b) => a - b);
    const firstLayerY = START_Y + START_H + 70; // room for start-node edges
    const positions = new Map<string, Pt>();
    for (const l of layerYs) {
      const cols = layers.get(l)!;
      const rowWidth = cols.length * (NODE_W + H_GAP) - H_GAP;
      const rowX = (worldW - rowWidth) / 2;
      cols.forEach((st, i) => {
        positions.set(st.id, {
          x: snap(rowX + i * (NODE_W + H_GAP)),
          y: snap(firstLayerY + l * (NODE_H + LAYER_GAP)),
        });
      });
    }

    // 4. Start node: centered above the first layer.
    setStartPos({ x: snap((worldW - START_W) / 2), y: START_Y });
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => {
        const pos = positions.get(s.id);
        return pos ? { ...s, x: pos.x, y: pos.y } : s;
      }),
    }));
  };
  const removeStage = (stageId: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.filter((s) => s.id !== stageId).map((s) => ({ ...s, branches: s.branches.filter((br) => br.targetStageId !== stageId) })) }));
    if (selectedStageId === stageId) { setSelectedStageId(null); setSelectedEventId(null); }
  };
  /** Append a new stage to the process (chain mode wires it to the start or previous stage). */
  const appendStage = (p: RoutingProcess, st: RouteStage): RoutingProcess => {
    if (layoutMode === 'chain') {
      if (p.stages.length === 0) {
        const br = newBranch();
        br.label = 'Start path';
        br.targetType = 'stage';
        br.targetStageId = st.id;
        return { ...p, stages: [...p.stages, st], startBranches: [...p.startBranches, br] };
      }
      const prev = p.stages[p.stages.length - 1];
      const br = newBranch();
      br.targetType = 'stage';
      br.targetStageId = st.id;
      return {
        ...p,
        stages: p.stages.map((s) => (s.id === prev.id ? { ...s, branches: [...s.branches, br] } : s)).concat([st]),
      };
    }
    return { ...p, stages: [...p.stages, st] };
  };

  const addStageAt = (x: number, y: number) => {
    const st = newStage(`Stage ${process.stages.length + 1}`, x, y);
    setProcess((p) => appendStage(p, st));
    setSelectedStageId(st.id);
  };

  /** Drop an event on the blank canvas → auto-create a stage to hold it. */
  const addStageWithEvent = (x: number, y: number, eventType: WorkflowEventType) => {
    const st = newStage(`Stage ${process.stages.length + 1}`, x, y);
    st.events = [newEvent(eventType)];
    setProcess((p) => appendStage(p, st));
    setSelectedStageId(st.id);
    setSelectedEventId(st.events[0].id);
  };

  // ── Event ops ──
  const addEventToStage = (stageId: string, type: WorkflowEventType) => {
    const ev = newEvent(type);
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: [...s.events, ev] } : s)) }));
    setSelectedStageId(stageId); setSelectedEventId(ev.id);
  };
  const updateEventConfig = (stageId: string, eventId: string, patch: Record<string, any>) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, config: { ...e.config, ...patch } } : e)) } : s)) }));
  };
  const updateEventLabel = (stageId: string, eventId: string, label: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, label } : e)) } : s)) }));
  };
  const removeEvent = (stageId: string, eventId: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: s.events.filter((e) => e.id !== eventId) } : s)) }));
    if (selectedEventId === eventId) setSelectedEventId(null);
  };

  // ── Start event ops ──
  const addEventToStart = (type: WorkflowEventType) => {
    const ev = newEvent(type);
    setProcess((p) => ({ ...p, startEvents: [...p.startEvents, ev] }));
    setSelectedStart(true); setSelectedEventId(ev.id);
  };
  const updateStartEventConfig = (eventId: string, patch: Record<string, any>) => {
    setProcess((p) => ({ ...p, startEvents: p.startEvents.map((e) => (e.id === eventId ? { ...e, config: { ...e.config, ...patch } } : e)) }));
  };
  const updateStartEventLabel = (eventId: string, label: string) => {
    setProcess((p) => ({ ...p, startEvents: p.startEvents.map((e) => (e.id === eventId ? { ...e, label } : e)) }));
  };
  const removeStartEvent = (eventId: string) => {
    setProcess((p) => ({ ...p, startEvents: p.startEvents.filter((e) => e.id !== eventId) }));
    if (selectedEventId === eventId) setSelectedEventId(null);
  };

  // ── Event host resolution (stage vs start) ──
  const resolveEventHost = (eventId: string | null): { kind: 'start' } | { kind: 'stage'; stageId: string } | null => {
    if (!eventId) return null;
    if (process.startEvents.some((e) => e.id === eventId)) return { kind: 'start' };
    const stage = process.stages.find((s) => s.events.some((e) => e.id === eventId));
    return stage ? { kind: 'stage', stageId: stage.id } : null;
  };

  /** Patch an event's config wherever it lives (stage or start). */
  const applyEventPatch = (eventId: string, patch: Record<string, any>) => {
    const host = resolveEventHost(eventId);
    if (!host) return;
    if (host.kind === 'start') updateStartEventConfig(eventId, patch);
    else updateEventConfig(host.stageId, eventId, patch);
  };

  /** Select the event's host and open the configuration modal. */
  const openEventModal = (eventId: string) => {
    const host = resolveEventHost(eventId);
    if (!host) return;
    setSelectedEventId(eventId);
    setEventModalEventId(eventId);
    if (host.kind === 'start') {
      setSelectedStart(true);
      setSelectedStageId(null);
    } else {
      setSelectedStageId(host.stageId);
      setSelectedStart(false);
    }
    setSelectedEdgeId(null);
  };

  // ── Start branch ops ──
  const addStartBranch = (targetStageId?: string) => {
    const br = newBranch();
    br.label = 'Start path';
    br.targetType = 'stage';
    br.targetStageId = targetStageId || process.stages[0]?.id;
    setProcess((p) => ({ ...p, startBranches: [...p.startBranches, br] }));
  };
  const addStartBranchWithPorts = (fromPort: Port, toStageId: string, toPort: Port) => {
    const br = newBranch();
    br.label = 'Start path';
    br.targetType = 'stage';
    br.targetStageId = toStageId;
    br.fromPort = fromPort;
    br.toPort = toPort;
    setProcess((p) => ({ ...p, startBranches: [...p.startBranches, br] }));
    setSelectedStart(true);
  };
  const updateStartBranch = (branchId: string, patch: Partial<BranchCondition>) => {
    setProcess((p) => ({ ...p, startBranches: p.startBranches.map((br) => (br.id === branchId ? { ...br, ...patch } : br)) }));
  };
  const removeStartBranch = (branchId: string) => {
    setProcess((p) => ({ ...p, startBranches: p.startBranches.filter((br) => br.id !== branchId) }));
    if (selectedEdgeId === branchId) setSelectedEdgeId(null);
  };

  // ── Branch ops ──
  const addBranch = (stageId: string) => {
    const br = newBranch(); br.targetType = 'completed';
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, branches: [...s.branches, br] } : s)) }));
  };
  const addBranchWithPorts = (fromStageId: string, fromPort: Port, toStageId: string, toPort: Port) => {
    const br = newBranch(); br.label = 'New branch'; br.targetType = 'stage'; br.targetStageId = toStageId; br.fromPort = fromPort; br.toPort = toPort;
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === fromStageId ? { ...s, branches: [...s.branches, br] } : s)) }));
    setSelectedStageId(fromStageId);
  };
  const updateBranch = (stageId: string, branchId: string, patch: Partial<BranchCondition>) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, branches: s.branches.map((br) => (br.id === branchId ? { ...br, ...patch } : br)) } : s)) }));
  };
  const removeBranch = (stageId: string, branchId: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, branches: s.branches.filter((br) => br.id !== branchId) } : s)) }));
    if (selectedEdgeId === branchId) setSelectedEdgeId(null);
  };

  // ── Variable ops ──
  const addVariable = (name: string, fieldType: string) => {
    if (!name.trim()) return;
    const v = { ...newVariable(), name: name.trim(), fieldType };
    setProcess((p) => ({ ...p, variables: [...p.variables, v] }));
    setEditingNewVar(false); setNewVarName(''); setNewVarType('short_text');
  };
  const updateVariable = (varId: string, patch: Partial<WorkflowVariable>) => {
    setProcess((p) => ({ ...p, variables: p.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)) }));
  };
  const removeVariable = (varId: string) => { setProcess((p) => ({ ...p, variables: p.variables.filter((v) => v.id !== varId) })); };

  // ── Canvas interaction ──
  // The world is CSS-scaled by `zoom`, so pointer deltas must be divided by
  // zoom to land in world coordinates.
  const getWorldPos = (e: React.PointerEvent): Pt => {
    const rect = worldRef.current?.getBoundingClientRect();
    return rect ? { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom } : { x: 0, y: 0 };
  };

  const handleNodePointerDown = (e: React.PointerEvent, stageId: string) => {
    if (connectFrom || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({ id: stageId, kind: 'stage', dx: (e.clientX - rect.left) / zoom, dy: (e.clientY - rect.top) / zoom });
    // Simple mode: remember the drag origin so vertical movement reorders stages
    // and the card glides with the pointer.
    if (layoutMode === 'chain') {
      const idx = process.stages.findIndex((st) => st.id === stageId);
      const worldY = getWorldPos(e).y;
      const baseY = idx >= 0 ? stagePos(idx, process.stages[idx]).y : 0;
      chainDragRef.current = { stageId, startIdx: idx, startWorldY: worldY, grabOffsetWorld: worldY - baseY };
      setChainDragY(worldY);
    }
  };

  const handleStartPointerDown = (e: React.PointerEvent) => {
    if (connectFrom || layoutMode !== 'canvas' || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({ id: '__start__', kind: 'start', dx: (e.clientX - rect.left) / zoom, dy: (e.clientY - rect.top) / zoom });
  };

  const handlePortPointerDown = (e: React.PointerEvent, stageId: string, port: Port) => {
    e.preventDefault(); e.stopPropagation();
    const idx = process.stages.findIndex((st) => st.id === stageId);
    if (idx === -1) return;
    const a = stagePos(idx, process.stages[idx]);
    setConnectFrom({ stageId, port }); setConnectPos(portPos(a, port));
    setSelectedEdgeId(null); setSelectedStageId(stageId);
  };

  const handleStartPortPointerDown = (e: React.PointerEvent, port: Port) => {
    e.preventDefault(); e.stopPropagation();
    setConnectFrom({ stageId: '__start__', port });
    setConnectPos(portPos(startNodePos, port, START_W, startNodeH));
    setSelectedEdgeId(null); setSelectedStageId(null); setSelectedStart(true);
  };

  const handleNodePointerUp = (e: React.PointerEvent, stageId: string) => {
    if (!connectFrom || connectFrom.stageId === stageId) return;
    e.preventDefault(); e.stopPropagation();
    const idx = process.stages.findIndex((st) => st.id === stageId);
    if (idx === -1) return;
    const b = stagePos(idx, process.stages[idx]);
    const toPort = nearestPort(b, getWorldPos(e));
    if (connectFrom.stageId === '__start__') {
      addStartBranchWithPorts(connectFrom.port, stageId, toPort);
    } else {
      addBranchWithPorts(connectFrom.stageId, connectFrom.port, stageId, toPort);
    }
    setConnectFrom(null); setConnectPos(null);
  };

  const handleEdgePortPointerDown = (e: React.PointerEvent, branchId: string, side: 'from' | 'to') => {
    e.preventDefault(); e.stopPropagation();
    worldRef.current?.setPointerCapture(e.pointerId);
    setDraggingEdgePort({ branchId, side });
  };

  const handleWorldPointerMove = (e: React.PointerEvent) => {
    // Background pan (Canvas mode): drag the empty canvas to scroll the viewport.
    if (panning) {
      const canvas = worldRef.current?.closest('.ws-canvas') as HTMLElement | null;
      if (canvas) {
        canvas.scrollLeft = panning.scrollLeft - (e.clientX - panning.startX);
        canvas.scrollTop = panning.scrollTop - (e.clientY - panning.startY);
      }
      return;
    }
    if (draggingEdgePort) {
      const { branchId, side } = draggingEdgePort;
      const pos = getWorldPos(e);
      const stageSource = process.stages.find((st) => st.branches.some((b) => b.id === branchId));
      if (stageSource) {
        const br = stageSource.branches.find((b) => b.id === branchId);
        if (!br || br.targetType === 'completed') return;
        const srcIdx = process.stages.findIndex((st) => st.id === stageSource.id);
        const srcPos = stagePos(srcIdx, stageSource);
        if (side === 'from') {
          updateBranch(stageSource.id, branchId, { fromPort: nearestPort(srcPos, pos) });
        } else {
          const tIdx = process.stages.findIndex((st) => st.id === br.targetStageId);
          if (tIdx === -1) return;
          updateBranch(stageSource.id, branchId, { toPort: nearestPort(stagePos(tIdx, process.stages[tIdx]), pos) });
        }
        return;
      }
      const startBr = process.startBranches.find((b) => b.id === branchId);
      if (startBr) {
        if (side === 'from') {
          updateStartBranch(branchId, { fromPort: nearestPort(startNodePos, pos) });
        } else {
          const tIdx = process.stages.findIndex((st) => st.id === startBr.targetStageId);
          if (tIdx === -1) return;
          updateStartBranch(branchId, { toPort: nearestPort(stagePos(tIdx, process.stages[tIdx]), pos) });
        }
        return;
      }
      return;
    }
    if (connectFrom && worldRef.current) { setConnectPos(getWorldPos(e)); return; }
    if (!dragging || !worldRef.current) return;

    // Simple (chain) mode: vertical drag reorders the stage sequence live and
    // the dragged card glides with the pointer (continuous translateY).
    if (dragging.kind === 'stage' && layoutMode === 'chain' && chainDragRef.current) {
      const { stageId, startIdx, startWorldY } = chainDragRef.current;
      const worldY = getWorldPos(e).y;
      setChainDragY(worldY);
      const target = Math.max(0, Math.min(process.stages.length - 1, startIdx + Math.round((worldY - startWorldY) / CHAIN_SPACING)));
      setProcess((p) => {
        const cur = p.stages.findIndex((s) => s.id === stageId);
        if (cur === -1 || cur === target) return p;
        const next = [...p.stages];
        const [moved] = next.splice(cur, 1);
        next.splice(target, 0, moved);
        return { ...p, stages: next };
      });
      return;
    }

    const rect = worldRef.current.getBoundingClientRect();
    const nx = Math.round(Math.max(0, (e.clientX - rect.left) / zoom - dragging.dx) / GRID) * GRID;
    const ny = Math.round(Math.max(0, (e.clientY - rect.top) / zoom - dragging.dy) / GRID) * GRID;
    if (dragging.kind === 'start') setStartPos({ x: nx, y: ny });
    else updateStage(dragging.id, { x: nx, y: ny });
  };

  /** Background drag in Canvas mode pans the canvas (scrolls the viewport). */
  const handleWorldPointerDown = (e: React.PointerEvent) => {
    if (layoutMode !== 'canvas' || e.button !== 0 || connectFrom || dragging || draggingEdgePort) return;
    e.preventDefault();
    const canvas = worldRef.current?.closest('.ws-canvas') as HTMLElement | null;
    if (!canvas) return;
    worldRef.current?.setPointerCapture(e.pointerId);
    setPanning({ startX: e.clientX, startY: e.clientY, scrollLeft: canvas.scrollLeft, scrollTop: canvas.scrollTop });
  };

  const handleWorldPointerUp = (e?: React.PointerEvent) => {
    if (e && worldRef.current?.hasPointerCapture(e.pointerId)) {
      worldRef.current.releasePointerCapture(e.pointerId);
    }
    setDragging(null); setDraggingEdgePort(null); setConnectFrom(null); setConnectPos(null);
    chainDragRef.current = null;
    setChainDragY(null);
    setPanning(null);
  };

  const commitStageLabel = (stageId: string, value: string) => { setEditingLabelId(null); const name = value.trim(); if (name) updateStage(stageId, { name }); };

  const handleWorldDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const p = JSON.parse(payload);
      const rect = worldRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round(Math.max(0, (e.clientX - rect.left - NODE_W / 2) / zoom) / GRID) * GRID;
      const y = Math.round(Math.max(0, (e.clientY - rect.top - 30) / zoom) / GRID) * GRID;
      if (p.type === 'stage') {
        addStageAt(x, y);
      } else if (p.type === 'event') {
        // Dropping an event on the blank canvas auto-creates a stage to hold it.
        addStageWithEvent(x, y, p.eventType as WorkflowEventType);
      }
    } catch { /* ignore */ }
  };

  const handleStageDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault(); e.stopPropagation();
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try { const p = JSON.parse(payload); if (p.type === 'event') addEventToStage(stageId, p.eventType); } catch { /* ignore */ }
  };

  const handleStartDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try { const p = JSON.parse(payload); if (p.type === 'event') addEventToStart(p.eventType); } catch { /* ignore */ }
  };

  // ── Serialize / Deserialize ──
  const serializeProcess = (): RoutingProcess => ({ ...process });

  // ── Save ──
  const doSave = async () => {
    if (!def) return;
    setSaving(true); setSaveError(null);
    try {
      const config = serializeProcess();
      const res = await fetch('/api/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: def.id, name: process.name, description: process.description, tableId: process.tableId, config }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setDef(json.data as WorkflowDef);
      setSavedMsg('Workflow saved');
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const doActivate = async () => {
    if (!def) return;
    setSaving(true); setSaveError(null);
    try {
      const config = serializeProcess();
      const res = await fetch('/api/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: def.id, action: 'activate', config, notes: 'Published from Workflow Studio' }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const fresh = await fetch(`/api/workflows?id=${encodeURIComponent(def.id)}`).then((r) => r.json());
      if (fresh.success) { setDef(fresh.data as WorkflowDef); setVersions(fresh.data.versions || []); }
      setSavedMsg('Workflow activated');
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const doStartEdit = async () => {
    if (!def) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: def.id, action: 'start-edit' }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setDef(json.data as WorkflowDef);
      setSavedMsg('Editing draft');
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const doRollback = async (targetVersion: number) => {
    if (!def) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: def.id, action: 'rollback', targetVersion }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const fresh = await fetch(`/api/workflows?id=${encodeURIComponent(def.id)}`).then((r) => r.json());
      if (fresh.success) { setDef(fresh.data as WorkflowDef); setProcess((fresh.data.config?.stages ? { ...process, ...fresh.data.config, stages: fresh.data.config.stages, variables: fresh.data.config.variables || [], startEvents: fresh.data.config.startEvents || [], startBranches: fresh.data.config.startBranches || [] } : process)); }
      setSavedMsg(`Rolled back to version ${targetVersion}`);
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const doDiscard = async () => {
    if (!def) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workflows', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: def.id, action: 'discard-draft' }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setDef(json.data as WorkflowDef);
      const source = json.data.publishedConfig || json.data.config;
      if (source?.stages) setProcess({ ...process, stages: source.stages, variables: source.variables || [], startEvents: source.startEvents || [], startBranches: source.startBranches || [], triggerOn: source.triggerOn || [], triggerCondition: source.triggerCondition || [], startMode: source.startMode || 'record', restConfig: { path: '', method: 'POST', headers: '', authToken: '', payloadExample: '', ...(source.restConfig || {}) }, scheduleConfig: { preset: 'custom', cron: '', timezone: 'UTC', ...(source.scheduleConfig || {}) } } as any);
      setSavedMsg('Draft discarded — reverted to published version');
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  // ── Auth guard ──
  if (!allowedRoles.includes(user?.role || '')) return <Unauthorized />;

  // ── Render: Properties Panel ──────────────────────────────────
  /** Full per-event configuration form (used by the event modal). */
  const renderEventConfigForm = (
    ev: WorkflowEvent,
    onUpdate: (eventId: string, patch: Record<string, any>) => void,
    onLabel: (eventId: string, label: string) => void,
    onRemove: (eventId: string) => void,
    isReadonly: boolean,
  ) => {
    const d = EVENT_DEFS.find((x) => x.type === ev.type);
    return (
      <>
        <div className="ws-props-group">
          <label className="ws-props-label">Label</label>
          <input className="ws-props-input" value={ev.label} onChange={(e) => onLabel(ev.id, e.target.value)} disabled={isReadonly} />
        </div>

        {ev.type === 'record' && (<>
          <div className="ws-props-group">
            <label className="ws-props-label">Target Model</label>
            <CustomSelect
              size="sm"
              searchable
              value={ev.config.model || ''}
              options={tables.map((t) => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
              onChange={(v) => onUpdate(ev.id, { model: String(v), filterGroups: [] })}
              disabled={isReadonly}
              placeholder="Select target model..."
            />
          </div>
          <div className="ws-props-group">
            <label className="ws-props-label">Operation</label>
            <select className="ws-props-input" value={ev.config.operation || 'read'} onChange={(e) => onUpdate(ev.id, { operation: e.target.value })} disabled={isReadonly}>
              <option value="create">Create</option>
              <option value="read">Read (one record)</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="list">List (many records)</option>
            </select>
          </div>
          {(ev.config.operation === 'read' || ev.config.operation === 'list') && (
            <div className="ws-props-group">
              <label className="ws-props-label">Record Filter</label>
              <button
                type="button"
                className="ws-props-input"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                onClick={() => setRecordFilterEventId(ev.id)}
                disabled={isReadonly}
                title="Build a filter with QueryStudio"
              >
                <Filter size={12} />
                {(() => {
                  const n = (ev.config.filterGroups || []).reduce((acc: number, g: any) => acc + (g.rules?.length || 0), 0);
                  return n > 0 ? `${n} rule${n > 1 ? 's' : ''}` : 'Build filters…';
                })()}
              </button>
            </div>
          )}
          <div className="ws-props-group">
            <label className="ws-props-label">Store result to variable</label>
            <input className="ws-props-input" value={ev.config.storeToVariable || ''} onChange={(e) => onUpdate(ev.id, { storeToVariable: e.target.value })} disabled={isReadonly} placeholder="e.g. records" />
          </div>
        </>)}

        {ev.type === 'notification' && (<>
          <div className="ws-props-group"><label className="ws-props-label">Channel</label><select className="ws-props-input" value={ev.config.channel || 'bell'} onChange={(e) => onUpdate(ev.id, { channel: e.target.value })} disabled={isReadonly}>{['bell', 'email'].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="ws-props-group"><label className="ws-props-label">Recipients</label><input className="ws-props-input" value={ev.config.recipients || ''} onChange={(e) => onUpdate(ev.id, { recipients: e.target.value })} disabled={isReadonly} placeholder="user@x or {{variable}}" /></div>
          <div className="ws-props-group"><label className="ws-props-label">Subject</label><input className="ws-props-input" value={ev.config.subject || ''} onChange={(e) => onUpdate(ev.id, { subject: e.target.value })} disabled={isReadonly} /></div>
          <div className="ws-props-group"><label className="ws-props-label">Message</label><textarea className="ws-props-input ws-props-textarea" value={ev.config.message || ''} onChange={(e) => onUpdate(ev.id, { message: e.target.value })} disabled={isReadonly} /></div>
        </>)}

        {ev.type === 'approval' && (<>
          <div className="ws-props-group"><label className="ws-props-label">Router Type</label><select className="ws-props-input" value={ev.config.routerType || 'role'} onChange={(e) => onUpdate(ev.id, { routerType: e.target.value })} disabled={isReadonly}>{ROUTER_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}</select></div>
          <div className="ws-props-group"><label className="ws-props-label">Router Value</label><input className="ws-props-input" value={ev.config.routerValue || ''} onChange={(e) => onUpdate(ev.id, { routerValue: e.target.value })} disabled={isReadonly} /></div>
          <div className="ws-props-group"><label className="ws-props-label">Display Label</label><input className="ws-props-input" value={ev.config.routerLabel || ''} onChange={(e) => onUpdate(ev.id, { routerLabel: e.target.value })} disabled={isReadonly} /></div>
          <div className="ws-props-group ws-props-check-row"><label><input type="checkbox" checked={!!ev.config.canApprove} onChange={(e) => onUpdate(ev.id, { canApprove: e.target.checked })} disabled={isReadonly} /> Approve</label><label><input type="checkbox" checked={!!ev.config.canReject} onChange={(e) => onUpdate(ev.id, { canReject: e.target.checked })} disabled={isReadonly} /> Reject</label></div>
          <div className="ws-props-group"><label className="ws-props-label">Timeout (hours)</label><input className="ws-props-input" type="number" min={0} value={ev.config.timeoutHours ?? ''} placeholder="No timeout" onChange={(e) => onUpdate(ev.id, { timeoutHours: e.target.value ? Number(e.target.value) : null })} disabled={isReadonly} /></div>
        </>)}

        {(ev.type === 'expression' || ev.type === 'transform') && (<>
          <div className="ws-props-group">
            <label className="ws-props-label">{ev.type === 'expression' ? 'JSONata Expression' : 'JSONata Transform'}</label>
            <button className="ws-props-input" style={{ display: 'block', textAlign: 'left', cursor: 'pointer', color: d?.color }} onClick={() => setExprModalEventId(ev.id)}>
              {ev.config.expression ? <code style={{ fontSize: 11 }}>{ev.config.expression}</code> : <em style={{ color: 'var(--sails-text-muted)' }}>Click to edit expression...</em>}
            </button>
          </div>
          <div className="ws-props-group"><label className="ws-props-label">Assign result to</label><input className="ws-props-input" value={ev.config.assignToVariable || ''} onChange={(e) => onUpdate(ev.id, { assignToVariable: e.target.value })} disabled={isReadonly} placeholder="variable name" /></div>
        </>)}

        {ev.type === 'script' && (<>
          <div className="ws-props-group"><label className="ws-props-label">BYOC Script</label><select className="ws-props-input" value={ev.config.scriptId || ''} onChange={(e) => onUpdate(ev.id, { scriptId: e.target.value })} disabled={isReadonly}><option value="">— select —</option><option value="scr_risk_score">Calculate Risk Score</option><option value="scr_erp_sync">Send to ERP</option></select></div>
          <div className="ws-props-group"><label className="ws-props-label">Timeout (ms)</label><input className="ws-props-input" type="number" min={100} value={ev.config.timeoutMs ?? 5000} onChange={(e) => onUpdate(ev.id, { timeoutMs: e.target.value ? Number(e.target.value) : 5000 })} disabled={isReadonly} /></div>
        </>)}

        <button className="sails-btn sails-btn--danger sails-btn--sm ws-props-delete-btn" onClick={() => onRemove(ev.id)}><Trash2 size={12} /> Remove Event</button>
      </>
    );
  };

  const renderEventConfigForms = (
    events: WorkflowEvent[],
    onUpdate: (eventId: string, patch: Record<string, any>) => void,
    onLabel: (eventId: string, label: string) => void,
    onRemove: (eventId: string) => void,
    isReadonly: boolean,
  ) => {
    const sel = selectedEventId ? events.find((e) => e.id === selectedEventId) || null : null;
    return (
      <>
        <div className="ws-props-section-title">Events ({events.length})</div>
        {events.length === 0 && <p className="ws-props-hint">Drop a Workflow Event onto the card in the canvas.</p>}
        {events.map((ev) => {
          const d = EVENT_DEFS.find((x) => x.type === ev.type);
          const isSel = selectedEventId === ev.id;
          return (
            <div key={ev.id} className={`ws-event-chip ${isSel ? 'ws-event-chip--selected' : ''}`}
              style={{ borderColor: d?.color, color: d?.color, margin: '2px 12px', cursor: 'pointer' }}
              onClick={() => setSelectedEventId(isSel ? null : ev.id)}
              onDoubleClick={(e) => { e.stopPropagation(); openEventModal(ev.id); }}
              title="Double-click to edit configuration"
            >
              {d?.icon}<span>{ev.label}</span>
            </div>
          );
        })}
        {sel && (
          <p className="ws-props-hint" style={{ padding: '2px 12px 8px' }}>
            Double-click an event to open its configuration.
          </p>
        )}
      </>
    );
  };

  const renderProperties = () => {
    const isActive = def?.status === 'active';
    const isReadonly = isActive;

    // Workflow tab (default)
    if (!selectedStage && !selectedStart && !selectedEdgeId) return (
      <div className="ws-properties">
        <div className="ws-props-header">
          <span className="ws-panel-title"><Settings size={12} /> Workflow</span>
          <button className="ws-props-header__float" onClick={() => setPropsFloating(!propsFloating)} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>{propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}</button>
        </div>
        <div className="ws-props-section-title">Metadata</div>
        <div className="ws-props-group">
          <label className="ws-props-label">Display Name</label>
          <input className="ws-props-input" value={process.name} onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))} disabled={isReadonly} />
        </div>
        <div className="ws-props-group">
          <label className="ws-props-label">Description</label>
          <textarea className="ws-props-input ws-props-textarea" value={process.description || ''} onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))} disabled={isReadonly} rows={2} />
        </div>
        <div className="ws-props-section-title">Auto-start Triggers</div>
        <div className="ws-props-group">
          <p className="ws-props-hint" style={{ paddingTop: 0 }}>
            {TRIGGER_OPS.find((o) => o.value === triggerOpOf(process.triggerOn))?.label || 'Inserted Or Updated'}
            {triggerRuleCount(process.triggerCondition) > 0 && ` · ${triggerRuleCount(process.triggerCondition)} rule${triggerRuleCount(process.triggerCondition) > 1 ? 's' : ''}`}
            <span style={{ marginLeft: 6 }}>— configure in Start Condition.</span>
          </p>
        </div>
        <p className="ws-props-hint">Both API-triggered and model-triggered starts are supported.</p>

        <div className="ws-props-section-title"><Hash size={11} /> Variables ({process.variables.length})</div>
        {process.variables.length === 0 && <p className="ws-props-hint">Workflow variables are shared across events, branches and scripts.</p>}
        {process.variables.map((v) => (
          <div key={v.id} className="ws-var-row" style={{ margin: '0 12px 3px' }}>
            <span className="ws-var-row__name">{v.name || <em>unnamed</em>}</span>
            <span className="ws-var-row__type">{v.fieldType}</span>
            <button className="ws-var-row__remove" onClick={() => removeVariable(v.id)}><X size={10} /></button>
          </div>
        ))}
        {editingNewVar ? (
          <div className="ws-palette-add-row" style={{ margin: '0 12px' }}>
            <input className="ws-props-input" style={{ flex: 1 }} placeholder="Variable name" value={newVarName} onChange={(e) => setNewVarName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addVariable(newVarName, newVarType); if (e.key === 'Escape') setEditingNewVar(false); }} autoFocus />
            <select className="ws-props-input" value={newVarType} onChange={(e) => setNewVarType(e.target.value)} style={{ width: 100 }}>{FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <button className="ws-icon-btn" onClick={() => addVariable(newVarName, newVarType)}><CheckCircle2 size={12} /></button>
            <button className="ws-icon-btn" onClick={() => setEditingNewVar(false)}><X size={12} /></button>
          </div>
        ) : (
          <button className="sails-btn sails-btn--ghost sails-btn--sm" style={{ margin: '0 12px 8px' }} onClick={() => setEditingNewVar(true)} disabled={isReadonly}>
            <Plus size={12} /> Add Variable
          </button>
        )}

        {versions.length > 0 && (
          <>
            <div className="ws-props-section-title"><History size={11} /> Version History</div>
            <div className="ws-version-list">
              {[...versions].sort((a, b) => b.version - a.version).map((v) => (
                <div key={v.id} className={`ws-version-item ${v.version === def?.currentVersion ? 'ws-version-item--current' : ''}`}>
                  <span className="ws-version-item__num">v{v.version}</span>
                  <span className="ws-version-item__info">{v.notes || '—'} {v.publishedBy ? `by ${v.publishedBy}` : ''}</span>
                  <span className="ws-version-item__date">{new Date(v.publishedAt).toLocaleDateString()}</span>
                  {!isReadonly && v.version !== def?.currentVersion && (
                    <button className="ws-icon-btn" title="Rollback to this version" onClick={() => doRollback(v.version)}><RotateCcw size={11} /></button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );

    // Stage selected
    if (selectedStage && !selectedEdgeId) {
      const s = selectedStage;
      const routerInfo = ROUTER_TYPES.find((r) => r.type === s.routerType);
      return (
        <div className="ws-properties">
          <div className="ws-props-header">
            <span className="ws-panel-title"><GitBranch size={12} /> Stage Properties</span>
            <button className="ws-props-header__float" onClick={() => setPropsFloating(!propsFloating)} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>{propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}</button>
          </div>
          <div className="ws-props-section-title">Name</div>
          <div className="ws-props-group"><input className="ws-props-input" value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} disabled={isReadonly} /></div>

          <div className="ws-props-section-title">Router</div>
          <div className="ws-props-group">
            <label className="ws-props-label">Router Type</label>
            <select className="ws-props-input" value={s.routerType} onChange={(e) => updateStage(s.id, { routerType: e.target.value as RouterType })} disabled={isReadonly}>
              {ROUTER_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
            </select>
          </div>
          <div className="ws-props-group">
            <label className="ws-props-label">Router Value</label>
            <input className="ws-props-input" value={s.routerValue} onChange={(e) => updateStage(s.id, { routerValue: e.target.value })} disabled={isReadonly} />
          </div>
          <div className="ws-props-group">
            <label className="ws-props-label">Display Label</label>
            <input className="ws-props-input" value={s.routerLabel} onChange={(e) => updateStage(s.id, { routerLabel: e.target.value })} disabled={isReadonly} />
          </div>

          <div className="ws-props-section-title">Entry Condition</div>
          <div className="ws-props-group">
            <input className="ws-props-input" value={s.entryCondition} placeholder="JSONata (optional)" onChange={(e) => updateStage(s.id, { entryCondition: e.target.value })} disabled={isReadonly} />
          </div>

          <div className="ws-props-section-title">Timeout (hours)</div>
          <div className="ws-props-group">
            <input className="ws-props-input" type="number" min={0} value={s.timeoutHours ?? ''} placeholder="No timeout" onChange={(e) => updateStage(s.id, { timeoutHours: e.target.value ? Number(e.target.value) : null })} disabled={isReadonly} />
          </div>

          {renderEventConfigForms(s.events,
            (eventId, patch) => updateEventConfig(s.id, eventId, patch),
            (eventId, label) => updateEventLabel(s.id, eventId, label),
            (eventId) => removeEvent(s.id, eventId),
            isReadonly)}

          <button className="sails-btn sails-btn--danger sails-btn--sm ws-props-delete-btn" onClick={() => removeStage(s.id)}><Trash2 size={12} /> Delete Stage</button>
        </div>
      );
    }

    // Start node selected
    if (selectedStart && !selectedEdgeId) {
      return (
        <div className="ws-properties">
          <div className="ws-props-header">
            <span className="ws-panel-title"><Play size={12} /> Start Properties</span>
            <button className="ws-props-header__float" onClick={() => setPropsFloating(!propsFloating)} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>{propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}</button>
          </div>
          <p className="ws-props-hint" style={{ paddingTop: 4 }}>The workflow always starts here. Events on the Start node run when the workflow starts — there is no approver or router on this node.</p>

          <div className="ws-props-section-title"><Play size={11} /> Start Condition</div>
          <div className="ws-props-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--sails-text-primary)' }}>
                {process.startMode === 'record' && (
                  <>
                    Record Trigger · {TRIGGER_OPS.find((o) => o.value === triggerOpOf(process.triggerOn))?.label || 'Inserted Or Updated'}
                    {process.tableId ? <span style={{ color: 'var(--sails-text-muted)', marginLeft: 4 }}>in {selectedTable?.name || process.tableId}</span> : ''}
                    {triggerRuleCount(process.triggerCondition) > 0 && <span style={{ color: 'var(--sails-text-muted)' }}> · {triggerRuleCount(process.triggerCondition)} rule{triggerRuleCount(process.triggerCondition) > 1 ? 's' : ''}</span>}
                  </>
                )}
                {process.startMode === 'rest' && (
                  <>
                    RESTful · {process.restConfig.method || 'POST'} {process.restConfig.path || '/webhooks/…'}
                  </>
                )}
                {process.startMode === 'scheduled' && (
                  <>
                    Scheduled · {process.scheduleConfig.preset === 'custom'
                      ? (process.scheduleConfig.cron || 'No schedule yet')
                      : process.scheduleConfig.preset === 'hourly' ? 'Hourly' : 'Daily'}
                  </>
                )}
              </span>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => { setWizardStep(1); setStartConditionOpen(true); }} disabled={isReadonly}>
                <Settings size={12} /> Configure
              </button>
            </div>
          </div>

          {renderEventConfigForms(process.startEvents,
            updateStartEventConfig,
            updateStartEventLabel,
            removeStartEvent,
            isReadonly)}

          <div className="ws-props-section-title"><Link2 size={11} /> Start Branches ({process.startBranches.length})</div>
          {process.startBranches.length === 0 && (
            <p className="ws-props-hint">Drag a port from the Start node onto a stage to route the start. Without branches the flow starts at the first stage.</p>
          )}
          {process.startBranches.map((br) => (
            <div key={br.id} className="ws-props-group" style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, margin: '2px 12px', padding: 6 }}>
              <label className="ws-props-label">Label</label>
              <input className="ws-props-input" value={br.label} onChange={(e) => updateStartBranch(br.id, { label: e.target.value })} disabled={isReadonly} />
              <label className="ws-props-label" style={{ marginTop: 4 }}>Condition (JSONata, optional)</label>
              <input className="ws-props-input" value={br.expression} onChange={(e) => updateStartBranch(br.id, { expression: e.target.value })} disabled={isReadonly} placeholder="e.g. amount > 50000" />
              <label className="ws-props-label" style={{ marginTop: 4 }}>Target</label>
              <select className="ws-props-input" value={br.targetStageId || ''} onChange={(e) => updateStartBranch(br.id, { targetStageId: e.target.value })} disabled={isReadonly}>
                {process.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="ws-icon-btn ws-icon-btn--danger" title="Remove branch" onClick={() => removeStartBranch(br.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          {process.stages.length > 0 && (
            <button className="sails-btn sails-btn--ghost sails-btn--sm" style={{ margin: '0 12px 8px' }} onClick={() => addStartBranch(process.stages[0].id)} disabled={isReadonly}>
              <Plus size={12} /> Add Start Branch
            </button>
          )}
        </div>
      );
    }

    // Edge selected
    if (selectedEdgeId) {
      const owner = process.stages.find((st) => st.branches.some((b) => b.id === selectedEdgeId));
      const br = owner?.branches.find((b) => b.id === selectedEdgeId);
      if (!br || !owner) {
        // Start branch?
        const startBr = process.startBranches.find((b) => b.id === selectedEdgeId);
        if (!startBr) return null;
        return (
          <div className="ws-properties">
            <div className="ws-props-header">
              <span className="ws-panel-title"><Play size={12} /> Start Branch</span>
            </div>
            <div className="ws-props-section-title">Label</div>
            <div className="ws-props-group"><input className="ws-props-input" value={startBr.label} onChange={(e) => updateStartBranch(startBr.id, { label: e.target.value })} disabled={isReadonly} /></div>
            <div className="ws-props-section-title">Condition (JSONata, optional)</div>
            <div className="ws-props-group">
              <textarea className="ws-props-input ws-props-textarea" value={startBr.expression} onChange={(e) => updateStartBranch(startBr.id, { expression: e.target.value })} disabled={isReadonly} placeholder="e.g. amount > 50000" rows={2} />
            </div>
            <div className="ws-props-group">
              <label className="ws-props-label">Target</label>
              <select className="ws-props-input" value={startBr.targetStageId || ''} onChange={(e) => updateStartBranch(startBr.id, { targetStageId: e.target.value })} disabled={isReadonly}>
                {process.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="ws-props-group ws-props-check-row">
              <label><input type="checkbox" checked={!!startBr.fromPort} onChange={(e) => updateStartBranch(startBr.id, { fromPort: e.target.checked ? 'bottom' : undefined })} disabled={isReadonly} /> Custom from port</label>
            </div>
            {startBr.fromPort && (
              <div className="ws-props-group">
                <label className="ws-props-label">From Port</label>
                <select className="ws-props-input" value={startBr.fromPort} onChange={(e) => updateStartBranch(startBr.id, { fromPort: e.target.value as Port })} disabled={isReadonly}>{ALL_PORTS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </div>
            )}
            <button className="sails-btn sails-btn--danger sails-btn--sm ws-props-delete-btn" onClick={() => removeStartBranch(startBr.id)}><Unlink size={12} /> Remove Branch</button>
          </div>
        );
      }
      return (
        <div className="ws-properties">
          <div className="ws-props-header">
            <span className="ws-panel-title"><Link2 size={12} /> Branch Properties</span>
          </div>
          <div className="ws-props-section-title">Label</div>
          <div className="ws-props-group"><input className="ws-props-input" value={br.label} onChange={(e) => updateBranch(owner.id, br.id, { label: e.target.value })} disabled={isReadonly} /></div>
          <div className="ws-props-section-title">Condition (JSONata)</div>
          <div className="ws-props-group">
            <textarea className="ws-props-input ws-props-textarea" value={br.expression} onChange={(e) => updateBranch(owner.id, br.id, { expression: e.target.value })} disabled={isReadonly} placeholder="e.g. amount > 50000" rows={2} />
          </div>
          <div className="ws-props-group">
            <label className="ws-props-label">Target</label>
            <select className="ws-props-input" value={br.targetType === 'completed' ? '__completed__' : br.targetStageId || ''} onChange={(e) => { const v = e.target.value; if (v === '__completed__') updateBranch(owner.id, br.id, { targetType: 'completed', targetStageId: undefined }); else updateBranch(owner.id, br.id, { targetType: 'stage', targetStageId: v }); }} disabled={isReadonly}>
              <option value="__completed__">Completed (flow ends)</option>
              {process.stages.filter((s) => s.id !== owner.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="ws-props-hint" style={{ padding: '2px 0 0' }}>Targeting <strong>Completed</strong> ends the flow — no outgoing path is drawn.</p>
          </div>
          <div className="ws-props-group ws-props-check-row">
            <label><input type="checkbox" checked={!!br.fromPort} onChange={(e) => updateBranch(owner.id, br.id, { fromPort: e.target.checked ? 'bottom' : undefined })} disabled={isReadonly} /> Custom from port</label>
          </div>
          {br.fromPort && (
            <div className="ws-props-group">
              <label className="ws-props-label">From Port</label>
              <select className="ws-props-input" value={br.fromPort} onChange={(e) => updateBranch(owner.id, br.id, { fromPort: e.target.value as Port })} disabled={isReadonly}>{ALL_PORTS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </div>
          )}
          <button className="sails-btn sails-btn--danger sails-btn--sm ws-props-delete-btn" onClick={() => removeBranch(owner.id, br.id)}><Unlink size={12} /> Remove Branch</button>
        </div>
      );
    }

    return null;
  };

  // ── Render: Stage Card ──
  const renderStageCard = (s: RouteStage, idx: number) => {
    const pos = stagePos(idx, s);
    const isSel = selectedStageId === s.id;
    const routerInfo = ROUTER_TYPES.find((r) => r.type === s.routerType);

    const isChainDragging = layoutMode === 'chain' && dragging?.id === s.id && chainDragY !== null && chainDragRef.current;
    // Keep the dragged card glued to the pointer: base slot Y + glide offset.
    const dragOffsetY = isChainDragging
      ? chainDragY - pos.y - chainDragRef.current!.grabOffsetWorld
      : 0;

    return (
      <div
        key={s.id}
        className={`ws-stage ${isSel ? 'ws-stage--selected' : ''} ${layoutMode === 'canvas' ? 'ws-stage--canvas' : ''} ${connectFrom ? 'ws-stage--connectable' : ''}${isChainDragging ? ' ws-stage--dragging' : ''}`}
        style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H, ...(isChainDragging ? { transform: `translateY(${dragOffsetY}px)`, zIndex: 30 } : {}) }}
        onPointerDown={(e) => handleNodePointerDown(e, s.id)}
        onPointerUp={(e) => handleNodePointerUp(e, s.id)}
        onClick={(e) => { e.stopPropagation(); setSelectedStageId(s.id); setSelectedEventId(null); setSelectedEdgeId(null); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => handleStageDrop(e, s.id)}
      >
        <div className="ws-stage__top">
          <span className="ws-stage__num">{idx + 1}</span>
          {editingLabelId === s.id ? (
            <input className="ws-stage__name-input" defaultValue={s.name} autoFocus onFocus={(e) => e.currentTarget.select()} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitStageLabel(s.id, (e.target as HTMLInputElement).value); } if (e.key === 'Escape') { e.stopPropagation(); setEditingLabelId(null); } }} onBlur={(e) => commitStageLabel(s.id, e.target.value)} />
          ) : (
            <span className="ws-stage__name" title="Double-click to rename" onDoubleClick={() => { setSelectedStageId(s.id); setEditingLabelId(s.id); }}>{s.name}</span>
          )}
          <div className="ws-stage__actions">
            <button className="ws-icon-btn ws-icon-btn--danger" title="Delete stage" onClick={(e) => { e.stopPropagation(); removeStage(s.id); }}><Trash2 size={12} /></button>
          </div>
        </div>
        <div className="ws-stage__badges">
          {routerInfo && <span className="ws-badge ws-badge--router">{routerInfo.icon}{s.routerLabel || routerInfo.label}</span>}
          {s.entryCondition && <span className="ws-badge ws-badge--cond"><Filter size={10} /> cond</span>}
          {s.timeoutHours && <span className="ws-badge ws-badge--timeout"><Clock size={10} /> {s.timeoutHours}h</span>}
          {s.events.length > 0 && <span className="ws-badge ws-badge--events">{s.events.length} event{s.events.length > 1 ? 's' : ''}</span>}
        </div>
        <div className="ws-stage__events">
          {s.events.length === 0 ? <span className="ws-stage__events-empty">Drop a Workflow Event here</span> : s.events.slice(0, 3).map((ev) => {
            const def = EVENT_DEFS.find((d) => d.type === ev.type);
            const isEvSel = selectedEventId === ev.id && isSel;
            return <span key={ev.id} className={`ws-event-chip ${isEvSel ? 'ws-event-chip--selected' : ''}`} style={{ borderColor: def?.color, color: def?.color }} title={`${ev.label} — double-click to edit`} onClick={(e) => { e.stopPropagation(); setSelectedStageId(s.id); setSelectedEventId(isEvSel ? null : ev.id); }} onDoubleClick={(e) => { e.stopPropagation(); openEventModal(ev.id); }}>{def?.icon}<span>{ev.label}</span></span>;
          })}
          {s.events.length > 3 && <span className="ws-stage__events-more">+{s.events.length - 3}</span>}
        </div>
        <div className="ws-stage__branchbar">
          <Link2 size={11} />
          {s.branches.length === 0 ? <span className="ws-stage__branch-empty">next →</span> : <span className="ws-stage__branch-count">{s.branches.length} branch{s.branches.length > 1 ? 'es' : ''}</span>}
          <button className="ws-stage__add-branch" title="Add branch" onClick={(e) => { e.stopPropagation(); setSelectedStageId(s.id); addBranch(s.id); }}><Plus size={11} /> Branch</button>
        </div>
        {ALL_PORTS.map((p) => (
          <span key={p} className={`ws-port ws-port--${p} ${connectFrom ? 'ws-port--active' : ''}`}
            style={{ position: 'absolute', ...(p === 'top' ? { top: -8, left: '50%' } : p === 'bottom' ? { bottom: -8, left: '50%' } : p === 'left' ? { left: -8, top: '50%' } : { right: -8, top: '50%' }) }}
            onPointerDown={(e) => handlePortPointerDown(e, s.id, p)}
            title={`Connect from ${p}`}
          />
        ))}
      </div>
    );
  };

  // ── Render: Palette ──
  const renderPalette = () => (
    <div className="ws-palette">
      <div className="ws-palette__header">
        <span className="ws-panel-title"><Workflow size={12} /> Elements</span>
        <button className="ws-props-header__float" onClick={() => setPaletteFloating(!paletteFloating)} title={paletteFloating ? 'Dock palette' : 'Float palette'}>
          {paletteFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
        </button>
      </div>
      <div className="ws-palette__content">
        <div className="ws-palette-item ws-palette-item--stage" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'stage' }))}>
          <span className="ws-palette-icon"><GitBranch size={14} /></span>
          <span className="ws-palette-info"><span className="ws-palette-name">Stage</span><span className="ws-palette-desc">Drag onto canvas</span></span>
        </div>

        <div className="ws-panel-title ws-panel-title--rule"><Zap size={12} /> Workflow Events</div>
        <span className="ws-palette-drop-hint">Drag into a stage card</span>
        {EVENT_DEFS.map((d) => (
          <div key={d.type} className="ws-palette-item" draggable onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'event', eventType: d.type }))}>
            <span className="ws-palette-icon" style={{ background: `${d.color}22`, color: d.color }}>{d.icon}</span>
            <span className="ws-palette-info"><span className="ws-palette-name">{d.label}</span><span className="ws-palette-desc">{d.desc}</span></span>
          </div>
        ))}

        <div className="ws-palette-help">
          <p><MousePointer2 size={11} /> Simple: auto-layout. Canvas: drag free.</p>
          <p><GitBranch size={11} /> Drag a port dot to connect stages.</p>
          <p><Split size={11} /> Add branches from a stage's + Branch bar.</p>
        </div>
      </div>
    </div>
  );

  // ── Render: Expression/Transform Modal ──
  const renderExprModal = () => {
    if (!exprModalEvent) return null;
    const def = EVENT_DEFS.find((d) => d.type === exprModalEvent.type);
    const sample = Object.fromEntries(process.variables.filter((v) => v.name).map((v) => [v.name, v.fieldType === 'number' || v.fieldType === 'currency' ? (v.defaultValue ?? 0) : (v.defaultValue ?? '')]));
    const onApply = (v: string) => {
      if (selectedStage) updateEventConfig(selectedStage.id, exprModalEvent.id, { expression: v });
      else if (selectedStart) updateStartEventConfig(exprModalEvent.id, { expression: v });
    };
    const hostName = selectedStage ? selectedStage.name : selectedStart ? 'Start' : '';
    return (
      <div className="ws-modal-overlay" onClick={() => setExprModalEventId(null)}>
        <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ws-modal__header">
            <span className="ws-modal__icon" style={{ color: def?.color, background: `${def?.color}18` }}>{def?.icon}</span>
            <div className="ws-modal__titles">
              <span className="ws-modal__title">{def?.label} — {exprModalEvent.label}</span>
              <span className="ws-modal__sub">{hostName ? `Host: ${hostName} · ` : ''}JSONata editor</span>
            </div>
            <button className="ws-icon-btn" onClick={() => setExprModalEventId(null)}><X size={15} /></button>
          </div>
          <div className="ws-modal__body">
            <ExpressionEditor showSnippets variables={process.variables.map((v) => ({ id: v.id, name: v.name, fieldType: v.fieldType }))} value={exprModalEvent.config.expression || ''} onChange={onApply} sample={sample} />
            <p className="ws-props-hint">Type <code>$</code> for function suggestions (<code>$sum, $uppercase, $split, $map…</code>). Use <strong>Test</strong> to evaluate against variables.</p>
          </div>
          <div className="ws-modal__footer">
            <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setExprModalEventId(null)}>Cancel</button>
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setExprModalEventId(null)}><CheckCircle2 size={14} /> Done</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main Render ──
  const isActive = def?.status === 'active';
  const isDraft = def?.status === 'draft';
  const isNew = !def;

  // Tools cluster offset from the canvas right edge: when the properties panel
  // is undocked it overlays the canvas, so the buttons automatically shift left
  // by the panel's width (+15px gap) — docked state keeps the fixed 27px.
  const toolsRightPx = propsFloating ? (propsVisible ? propsWidth : 36) + 15 : 27;

  // Hold the editor until the workflow definition is applied — the canvas must
  // never paint before the real data is ready (avoids flashing a sample/empty
  // diagram while loading). New workflows have no workflowId, so loading stays
  // false and the empty editor renders immediately.
  if (loading) return <LoadingScreen />;

  return (
    <div className="ws-root">
      {error && <div className="ws-banner ws-banner--readonly" style={{ gap: 4 }}><AlertTriangle size={12} /> {error}</div>}

      {/* Toolbar */}
      <div className="ws-toolbar">
        <span className="ws-toolbar__brand">
          <Workflow size={15} /> Workflow Studio
        </span>
        <input className="ws-toolbar__name" value={process.name} onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))} disabled={isActive} placeholder="Process name" />
        {process.tableId && <span className="ws-toolbar__table">{process.tableId}</span>}
        {def && <span className={`ws-toolbar__status ws-toolbar__status--${def.status}`}>{def.status}</span>}

        <div className="ws-mode-toggle">
          <button className={`ws-mode-btn ${layoutMode === 'chain' ? 'ws-mode-btn--active' : ''}`} onClick={() => setLayoutMode('chain')}><ChevronsUpDown size={13} /> Simple</button>
          <button className={`ws-mode-btn ${layoutMode === 'canvas' ? 'ws-mode-btn--active' : ''}`} onClick={() => setLayoutMode('canvas')}><Layers size={13} /> Canvas</button>
        </div>

        <div className="ws-toolbar__actions">
          {isActive && <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={doStartEdit} disabled={saving}><Pencil size={12} /> Edit</button>}
          {isActive && <button className="sails-btn sails-btn--ghost sails-btn--sm" disabled={saving}>Deactivate</button>}
          {isDraft && <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={doDiscard} disabled={saving}><RotateCcw size={12} /> Discard</button>}
          {(isNew || isDraft) && <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={doSave} disabled={saving}><Save size={12} /> {saving ? 'Saving...' : 'Save'}</button>}
          {(isNew || isDraft) && <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={doActivate} disabled={saving}><Play size={12} /> {saving ? 'Activating...' : 'Activate'}</button>}
        </div>
      </div>

      {isActive && <div className="ws-banner ws-banner--readonly"><AlertTriangle size={12} /> This workflow is active and read-only. Click <strong>Edit</strong> to start a draft, then activate when ready.</div>}
      {isDraft && def?.publishedConfig && <div className="ws-banner"><Pencil size={12} /> Editing draft. Changes won't affect running instances until <strong>activated</strong>. Previous version still runs on in-flight instances.</div>}
      {saveError && <div className="ws-banner" style={{ background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.2)', color: '#ef4444' }}><AlertTriangle size={12} /> {saveError} <button className="ws-icon-btn" style={{ marginLeft: 8 }} onClick={() => setSaveError(null)}><X size={11} /></button></div>}

      {/* Toast */}
      {savedMsg && <div className="ws-toast">{savedMsg}</div>}

      {/* Body */}
      <div className="ws-body" style={{ gridTemplateColumns: `${paletteCollapsed ? '0px' : paletteFloating ? '' : `${paletteWidth}px`} auto ${propsFloating ? '' : `${propsWidth}px`}` }}>
        {/* Palette */}
        <div
          className={`ws-palette-outer ${paletteFloating ? 'ws-palette-outer--floating' : ''} ${paletteVisible ? 'ws-palette-outer--open' : ''}`}
          style={{ width: paletteFloating ? (paletteVisible ? paletteWidth : 36) : '100%' }}
          onMouseEnter={() => { if (paletteFloating) setPaletteVisible(true); }}
          onMouseLeave={() => { if (paletteFloating) setPaletteVisible(false); }}
        >
          {renderPalette()}
          {!paletteFloating && <div className="ws-palette-resize" onMouseDown={(e) => { e.preventDefault(); setPaletteResizing(true); }} />}
        </div>
        {paletteCollapsed && <div className="ws-palette-tab" onClick={() => setPaletteCollapsed(false)}><Maximize2 size={14} /></div>}

        {/* Canvas — the tools cluster floats above the scroll container so it
            stays visible (sticky near the properties panel) while the canvas pans. */}
        <div className="ws-canvas-wrap">
          {layoutMode === 'canvas' && (
            <div className="ws-canvas__tools" style={{ right: toolsRightPx }}>
                <button
                  type="button"
                  className="ws-canvas__tool-btn"
                  onClick={(e) => { e.stopPropagation(); doAutoLayout(); }}
                  title="Auto-arrange the workflow"
                >
                  <Wand2 size={13} /> Auto
                </button>
                <div className="ws-canvas__zoom">
                  <button type="button" className="ws-canvas__tool-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(3, Math.max(0.2, +(z / 1.25).toFixed(3)))); }} title="Zoom out">−</button>
                  <span className="ws-canvas__zoom-val" title="Reset zoom" onClick={(e) => { e.stopPropagation(); setZoom(1); }}>{Math.round(zoom * 100)}%</span>
                  <button type="button" className="ws-canvas__tool-btn" onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(3, Math.max(0.2, +(z * 1.25).toFixed(3)))); }} title="Zoom in">+</button>
                  <button type="button" className="ws-canvas__tool-btn" onClick={(e) => { e.stopPropagation(); setZoom(1); }} title="Reset zoom">100%</button>
                </div>
                <button
                  type="button"
                  className="ws-canvas__tool-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSizeDraft({ w: String(canvasW), h: canvasH ? String(canvasH) : '' });
                    setSizePopoverOpen((v) => !v);
                  }}
                  title="Set canvas size"
                >
                  <Maximize2 size={12} /> Canvas
                </button>
                {sizePopoverOpen && (
                  <div className="ws-canvas__size-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="ws-canvas__size-row">
                      <label>W</label>
                      <input type="number" min={200} step={20} value={sizeDraft.w} onChange={(e) => setSizeDraft((d) => ({ ...d, w: e.target.value }))} />
                      <label>H</label>
                      <input type="number" min={200} step={20} value={sizeDraft.h} placeholder="auto" onChange={(e) => setSizeDraft((d) => ({ ...d, h: e.target.value }))} />
                    </div>
                    <div className="ws-canvas__size-actions">
                      <button
                        type="button"
                        className="ws-canvas__tool-btn"
                        onClick={() => {
                          const w = Math.max(200, parseInt(sizeDraft.w, 10) || 1400);
                          const h = parseInt(sizeDraft.h, 10);
                          setCanvasW(w);
                          setCanvasH(h && h > 0 ? Math.max(200, h) : null);
                          setSizePopoverOpen(false);
                        }}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="ws-canvas__tool-btn"
                        onClick={() => {
                          setCanvasW(1400);
                          setCanvasH(null);
                          setSizeDraft({ w: '1400', h: '' });
                          setSizePopoverOpen(false);
                        }}
                        title="Auto-fit to content"
                      >
                        Fit
                      </button>
                    </div>
                  </div>
                )}
              </div>
          )}
          <div className={`ws-canvas ${layoutMode === 'canvas' ? 'ws-canvas--canvas' : ''}${panning ? ' ws-canvas--panning' : ''}`} onClick={() => { setSelectedStageId(null); setSelectedEventId(null); setSelectedEdgeId(null); setSelectedStart(false); }}>
          <div className="ws-world-holder" style={{ width: worldW * zoom, height: worldH * zoom }}>
            <div className="ws-world" ref={worldRef} style={{ width: worldW, height: worldH, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              onPointerDown={handleWorldPointerDown}
              onPointerMove={handleWorldPointerMove} onPointerUp={handleWorldPointerUp}
              onDrop={handleWorldDrop} onDragOver={(e) => e.preventDefault()}
            >
            <svg className="ws-edges" width={worldW} height={worldH}>
              <defs>
                <marker id="ws-arrow-branch" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" /></marker>
              </defs>
              {edges.map((e) => {
                const isStart = e.kind === 'start';
                const isSel = selectedEdgeId === e.id;
                const aW = isStart ? START_W : NODE_W;
                const aH = isStart ? startNodeH : NODE_H;
                const handleFrom = portPos(e.a, e.fromPort, aW, aH);
                const handleTo = portPos(e.b, e.toPort, NODE_W, NODE_H);
                const pathD = roundedOrthogonalPath(orthogonalPoints(e.a, e.b, e.fromPort, e.toPort, aW, aH, NODE_W, NODE_H));
                const mid = edgeMidpoint(e.a, e.b, e.fromPort, e.toPort, aW, aH, NODE_W, NODE_H);
                return (
                  <g key={e.id} className={`ws-edge ${isSel ? 'ws-edge--selected' : ''}`}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={isSel ? 3 : 2}
                      markerEnd="url(#ws-arrow-branch)"
                      className="ws-edge-path--clickable"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(e.branchId || null);
                        if (e.sourceStageId) setSelectedStageId(e.sourceStageId);
                      }}
                    />
                    {e.label && (
                      <g pointerEvents="none">
                        <rect x={mid.x - 45} y={mid.y - 11} width={90} height={22} rx={11}
                          fill="rgba(255,255,255,0.95)" stroke="#3b82f6" strokeWidth={1} />
                        <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={10}
                          fill="#1e293b" fontWeight={600}>{e.label}</text>
                      </g>
                    )}
                    {isSel && (
                      <g className="ws-edge-handles">
                        <circle cx={handleFrom.x} cy={handleFrom.y} r={8} className="ws-edge-handle"
                          onPointerDown={(ev) => handleEdgePortPointerDown(ev, e.branchId!, 'from')} />
                        <circle cx={handleTo.x} cy={handleTo.y} r={8} className="ws-edge-handle"
                          onPointerDown={(ev) => handleEdgePortPointerDown(ev, e.branchId!, 'to')} />
                      </g>
                    )}
                  </g>
                );
              })}
              {connectFrom && connectPos && (() => {
                let sp: Pt | null = null;
                if (connectFrom.stageId === '__start__') {
                  sp = portPos(startNodePos, connectFrom.port, START_W, startNodeH);
                } else {
                  const fi = process.stages.findIndex((st) => st.id === connectFrom.stageId);
                  if (fi !== -1) sp = portPos(stagePos(fi, process.stages[fi]), connectFrom.port);
                }
                if (!sp) return null;
                return (
                  <line
                    x1={sp.x} y1={sp.y} x2={connectPos.x} y2={connectPos.y}
                    className="ws-connect-temp"
                    stroke="var(--sails-primary,#9dcee0)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    markerEnd="url(#ws-arrow-branch)"
                  />
                );
              })()}
            </svg>

            {process.stages.map((s, idx) => renderStageCard(s, idx))}

            {/* Start node — rectangle like a stage, no router/team */}
            <div
              className={`ws-start ${selectedStart ? 'ws-start--selected' : ''} ${layoutMode === 'canvas' ? 'ws-start--canvas' : ''}`}
              style={{ left: startNodePos.x, top: startNodePos.y, width: START_W, height: startNodeH }}
              onPointerDown={handleStartPointerDown}
              onClick={(e) => { e.stopPropagation(); setSelectedStart(true); setSelectedStageId(null); setSelectedEventId(null); setSelectedEdgeId(null); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleStartDrop}
            >
              <div className="ws-start__head">
                <span className="ws-start__icon"><Play size={16} /></span>
                <span className="ws-start__label">Start</span>
              </div>
              {process.startEvents.length > 0 && (
                <div className="ws-start__events">
                  {process.startEvents.slice(0, 3).map((ev) => {
                    const def = EVENT_DEFS.find((d) => d.type === ev.type);
                    const isEvSel = selectedEventId === ev.id && selectedStart;
                    return (
                      <span key={ev.id} className={`ws-event-chip ${isEvSel ? 'ws-event-chip--selected' : ''}`}
                        style={{ borderColor: def?.color, color: def?.color }} title={`${ev.label} — double-click to edit`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setSelectedStart(true); setSelectedEventId(isEvSel ? null : ev.id); }}
                        onDoubleClick={(e) => { e.stopPropagation(); openEventModal(ev.id); }}
                      >{def?.icon}<span>{ev.label}</span></span>
                    );
                  })}
                  {process.startEvents.length > 3 && <span className="ws-stage__events-more">+{process.startEvents.length - 3}</span>}
                </div>
              )}
              {/* 4 connection ports — drag to a stage to route the start */}
              {ALL_PORTS.map((p) => (
                <span
                  key={p}
                  className={`ws-port ws-port--${p} ${connectFrom ? 'ws-port--active' : ''}`}
                  style={{ position: 'absolute', ...(p === 'top' ? { top: -8, left: '50%' }
                    : p === 'bottom' ? { bottom: -8, left: '50%' }
                    : p === 'left' ? { left: -8, top: '50%' }
                    : { right: -8, top: '50%' }) }}
                  onPointerDown={(e) => handleStartPortPointerDown(e, p)}
                  title={`Connect from ${p}`}
                />
              ))}
            </div>

            {connectFrom && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, color: 'var(--sails-primary,#9dcee0)', background: 'var(--sails-bg-card,#fff)', padding: '4px 8px', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.1)', zIndex: 5 }}>Drop on a stage to connect · Esc to cancel</div>}
          </div>
          </div>
        </div>
        </div>

        {/* Properties */}
        <div
          className={`ws-props-outer ${propsFloating ? 'ws-props-outer--floating' : ''}`}
          style={{ width: propsFloating ? (propsVisible ? propsWidth : 36) : '100%' }}
          onMouseEnter={() => { if (propsFloating) setPropsVisible(true); }}
          onMouseLeave={() => { if (propsFloating) setPropsVisible(false); }}
        >
          {renderProperties()}
          {!propsFloating && <div className="ws-props-resize" onMouseDown={(e) => { e.preventDefault(); setPropsResizing(true); }} />}
        </div>
      </div>

      {/* Event Configuration Modal (double-click an event chip) */}
      {eventModalEventId && (() => {
        const host = resolveEventHost(eventModalEventId);
        const ev = host
          ? host.kind === 'start'
            ? process.startEvents.find((e) => e.id === eventModalEventId) || null
            : (process.stages.find((s) => s.id === host.stageId)?.events.find((e) => e.id === eventModalEventId) || null)
          : null;
        if (!ev) return null;
        const def = EVENT_DEFS.find((d) => d.type === ev.type);
        const hostName = host?.kind === 'start'
          ? 'Start'
          : (process.stages.find((s) => s.id === (host?.kind === 'stage' ? host.stageId : null))?.name || '');
        const onLabelFor = (eventId: string, label: string) => {
          const h = resolveEventHost(eventId);
          if (h?.kind === 'start') updateStartEventLabel(eventId, label);
          else if (h?.kind === 'stage') updateEventLabel(h.stageId, eventId, label);
        };
        const onRemoveFor = (eventId: string) => {
          const h = resolveEventHost(eventId);
          if (h?.kind === 'start') { removeStartEvent(eventId); setEventModalEventId(null); }
          else if (h?.kind === 'stage') { removeEvent(h.stageId, eventId); setEventModalEventId(null); }
        };
        return (
          <div className="ws-modal-overlay" onClick={() => setEventModalEventId(null)}>
            <div className="ws-modal ws-qstudio-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ color: def?.color, background: `${def?.color}18` }}>{def?.icon}</span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">{def?.label}</span>
                  <span className="ws-modal__sub">{hostName ? `Host: ${hostName} · ` : ''}{ev.label}</span>
                </div>
                <button className="ws-icon-btn" onClick={() => setEventModalEventId(null)}><X size={15} /></button>
              </div>
              <div className="ws-modal__body">
                {renderEventConfigForm(
                  ev,
                  (eventId, patch) => applyEventPatch(eventId, patch),
                  onLabelFor,
                  onRemoveFor,
                  isActive,
                )}
              </div>
              <div className="ws-modal__footer">
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setEventModalEventId(null)}>Cancel</button>
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setEventModalEventId(null)}><CheckCircle2 size={14} /> Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Expression/Transform Modal */}
      {renderExprModal()}

      {/* Start Condition Modal (wizard) */}
      {startConditionOpen && (
        <div className="ws-modal-overlay" onClick={() => setStartConditionOpen(false)}>
          <div className="ws-modal" style={{ width: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: 'rgba(16,185,129,.12)', color: '#10b981' }}><Play size={16} /></span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">Start Condition</span>
                <span className="ws-modal__sub">{wizardStep === 1 ? 'Step 1 of 2 — How should this workflow begin?' : 'Step 2 of 2 — Configure the trigger'}</span>
              </div>
              <button className="ws-icon-btn" onClick={() => setStartConditionOpen(false)}><X size={15} /></button>
            </div>

            {wizardStep === 1 && (
              <div className="ws-modal__body">
                <div className="ws-wizard-grid">
                  {([
                    { mode: 'record' as StartMode, icon: <Database size={18} />, title: 'Record Trigger', desc: 'Starts when a record is created or updated in a model.' },
                    { mode: 'rest' as StartMode, icon: <Globe size={18} />, title: 'RESTful', desc: 'Starts when an external system calls a webhook endpoint.' },
                    { mode: 'scheduled' as StartMode, icon: <Clock size={18} />, title: 'Scheduled', desc: 'Starts on a cron schedule, repeating hourly or daily.' },
                  ]).map((opt) => (
                    <button
                      key={opt.mode}
                      className={`ws-wizard-card ${process.startMode === opt.mode ? 'ws-wizard-card--selected' : ''}`}
                      onClick={() => setProcess((p) => ({ ...p, startMode: opt.mode }))}
                    >
                      <span className="ws-wizard-card__icon">{opt.icon}</span>
                      <span className="ws-wizard-card__title">{opt.title}</span>
                      <span className="ws-wizard-card__desc">{opt.desc}</span>
                      <span className="ws-wizard-card__check">{process.startMode === opt.mode && <CheckCircle2 size={14} />}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="ws-modal__body">
                {process.startMode === 'record' && (
                  <>
                    <div className="ws-props-section-title">Data Model</div>
                    <div className="ws-props-group">
                      <CustomSelect
                        searchable
                        value={process.tableId || ''}
                        options={modelOptions}
                        onChange={(v) => setProcess((p) => ({ ...p, tableId: v ? String(v) : null }))}
                        placeholder={tables.length === 0 ? 'No models found…' : 'Select a data model…'}
                      />
                      <p className="ws-props-hint" style={{ paddingTop: 4 }}>The model whose records trigger this workflow.</p>
                    </div>

                    <div className="ws-props-section-title">Triggered On</div>
                    <div className="ws-props-group">
                      <div className="ws-trigger-op-grid">
                        {TRIGGER_OPS.map((op) => (
                          <button
                            key={op.value}
                            type="button"
                            className={`ws-trigger-op ${triggerOpOf(process.triggerOn) === op.value ? 'ws-trigger-op--selected' : ''}`}
                            onClick={() => setProcess((p) => ({ ...p, triggerOn: [op.value] }))}
                          >
                            <span className="ws-trigger-op__label">{op.label}</span>
                            <span className="ws-trigger-op__desc">{op.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="ws-props-section-title">Condition</div>
                    <div className="ws-props-group">
                      <div className="ws-condition-row">
                        <span className="ws-condition-summary">
                          {triggerRuleCount(process.triggerCondition) === 0
                            ? 'No conditions — runs for every matching record'
                            : `${triggerRuleCount(process.triggerCondition)} rule${triggerRuleCount(process.triggerCondition) > 1 ? 's' : ''} in ${process.triggerCondition.length} group${process.triggerCondition.length > 1 ? 's' : ''}`}
                        </span>
                        <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setConditionOpen(true)}>
                          <Filter size={12} /> QueryStudio
                        </button>
                      </div>
                      <p className="ws-props-hint" style={{ paddingTop: 2 }}>Restrict which records trigger this workflow. Open QueryStudio to build field rules.</p>
                    </div>
                  </>
                )}

                {process.startMode === 'rest' && (
                  <>
                    <div className="ws-props-section-title">Endpoint</div>
                    <div className="ws-props-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select className="ws-props-input" style={{ width: 110 }} value={process.restConfig.method}
                        onChange={(e) => setProcess((p) => ({ ...p, restConfig: { ...p.restConfig, method: e.target.value } }))}>
                        {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input className="ws-props-input" style={{ flex: 1 }} placeholder="/api/webhooks/leads"
                        value={process.restConfig.path}
                        onChange={(e) => setProcess((p) => ({ ...p, restConfig: { ...p.restConfig, path: e.target.value } }))} />
                    </div>
                    <p className="ws-props-hint">External systems call this endpoint to start the workflow. Full URL is <code>/api/trigger{process.restConfig.path || '/…'}</code>.</p>

                    <div className="ws-props-section-title">Headers</div>
                    <div className="ws-props-group">
                      <textarea className="ws-props-input" rows={3} placeholder={'Content-Type: application/json\nX-API-Key: <key>'}
                        value={process.restConfig.headers}
                        onChange={(e) => setProcess((p) => ({ ...p, restConfig: { ...p.restConfig, headers: e.target.value } }))} />
                      <p className="ws-props-hint" style={{ paddingTop: 4 }}>One <code>Key: Value</code> pair per line.</p>
                    </div>

                    <div className="ws-props-section-title">Authentication</div>
                    <div className="ws-props-group">
                      <input className="ws-props-input" placeholder="Bearer token (optional)"
                        value={process.restConfig.authToken}
                        onChange={(e) => setProcess((p) => ({ ...p, restConfig: { ...p.restConfig, authToken: e.target.value } }))} />
                    </div>

                    <div className="ws-props-section-title">Payload Example</div>
                    <div className="ws-props-group">
                      <textarea className="ws-props-input" rows={4} placeholder={'{\n  "contractId": "C-1001",\n  "amount": 75000\n}'}
                        value={process.restConfig.payloadExample}
                        onChange={(e) => setProcess((p) => ({ ...p, restConfig: { ...p.restConfig, payloadExample: e.target.value } }))} />
                      <p className="ws-props-hint" style={{ paddingTop: 4 }}>Sample body shown to consumers of this trigger.</p>
                    </div>
                  </>
                )}

                {process.startMode === 'scheduled' && (
                  <>
                    <div className="ws-props-section-title">Interval</div>
                    <div className="ws-props-group">
                      <select className="ws-props-input"
                        value={process.scheduleConfig.preset}
                        onChange={(e) => {
                          const preset = e.target.value as ScheduleTriggerConfig['preset'];
                          setProcess((p) => ({
                            ...p,
                            scheduleConfig: {
                              ...p.scheduleConfig,
                              preset,
                              cron: preset === 'hourly' ? '0 * * * *' : preset === 'daily' ? '0 0 * * *' : p.scheduleConfig.cron,
                            },
                          }));
                        }}>
                        <option value="hourly">Hourly — every hour at minute 0</option>
                        <option value="daily">Daily — every day at midnight</option>
                        <option value="custom">Custom cron expression</option>
                      </select>
                    </div>

                    <div className="ws-props-section-title">Cron Expression</div>
                    <div className="ws-props-group">
                      <input className="ws-props-input" placeholder="0 9 * * 1-5"
                        value={process.scheduleConfig.cron}
                        onChange={(e) => setProcess((p) => ({ ...p, scheduleConfig: { ...p.scheduleConfig, cron: e.target.value, preset: 'custom' } }))} />
                      <p className="ws-props-hint" style={{ paddingTop: 4 }}>Standard 5-field cron: minute hour day-of-month month day-of-week.</p>
                    </div>

                    <div className="ws-props-section-title">Timezone</div>
                    <div className="ws-props-group">
                      <select className="ws-props-input" value={process.scheduleConfig.timezone}
                        onChange={(e) => setProcess((p) => ({ ...p, scheduleConfig: { ...p.scheduleConfig, timezone: e.target.value } }))}>
                        {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'].map((z) => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="ws-modal__footer">
              {wizardStep === 2 && (
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setWizardStep(1)}><CornerUpLeft size={13} /> Back</button>
              )}
              <div style={{ flex: 1 }} />
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setStartConditionOpen(false)}>Cancel</button>
              {wizardStep === 1 ? (
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setWizardStep(2)}>Next <ArrowRight size={13} /></button>
              ) : (
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setStartConditionOpen(false)}><CheckCircle2 size={14} /> Done</button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* QueryStudio — Record Trigger condition (production FilterBuilder) */}
      {conditionOpen && (
        <div className="ws-modal-overlay" onClick={() => setConditionOpen(false)}>
          <div className="ws-modal ws-qstudio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Filter size={16} /></span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">QueryStudio</span>
                <span className="ws-modal__sub">Record Trigger condition · {selectedTable?.name || 'No model selected'}</span>
              </div>
              <button className="ws-icon-btn" onClick={() => setConditionOpen(false)}><X size={15} /></button>
            </div>
            <div className="ws-modal__body">
              <FilterBuilder
                fields={selectedTable?.fields || []}
                rootTableName={selectedTable?.tableName || ''}
                initialGroups={process.triggerCondition}
                showHeader={false}
                title="Record Trigger Condition"
                onApply={(groups) => {
                  setProcess((p) => ({ ...p, triggerCondition: groups }));
                  setConditionOpen(false);
                }}
                onCancel={() => setConditionOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Record Event — filter builder (read / list operations) */}
      {recordFilterEventId && (() => {
        const hostEvent = process.startEvents.find((e) => e.id === recordFilterEventId)
          || process.stages.flatMap((s) => s.events).find((e) => e.id === recordFilterEventId);
        const modelTable = tables.find((t) => t.tableName === hostEvent?.config.model);
        return (
          <div className="ws-modal-overlay" onClick={() => setRecordFilterEventId(null)}>
            <div className="ws-modal ws-qstudio-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Filter size={16} /></span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">Record Filter</span>
                  <span className="ws-modal__sub">Record Event · {modelTable?.name || hostEvent?.config.model || 'No model selected'}</span>
                </div>
                <button className="ws-icon-btn" onClick={() => setRecordFilterEventId(null)}><X size={15} /></button>
              </div>
              <div className="ws-modal__body">
                {!hostEvent?.config.model ? (
                  <p className="ws-props-hint" style={{ padding: 12 }}>Select a target model first to build a filter.</p>
                ) : (
                  <FilterBuilder
                    fields={modelTable?.fields || []}
                    rootTableName={modelTable?.tableName || ''}
                    initialGroups={hostEvent.config.filterGroups || []}
                    showHeader={false}
                    title="Record Filter"
                    onApply={(groups) => {
                      if (process.startEvents.some((e) => e.id === recordFilterEventId)) {
                        updateStartEventConfig(recordFilterEventId, { filterGroups: groups });
                      } else {
                        const st = process.stages.find((s) => s.events.some((e) => e.id === recordFilterEventId));
                        if (st) updateEventConfig(st.id, recordFilterEventId, { filterGroups: groups });
                      }
                      setRecordFilterEventId(null);
                    }}
                    onCancel={() => setRecordFilterEventId(null)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default WorkflowStudio;
