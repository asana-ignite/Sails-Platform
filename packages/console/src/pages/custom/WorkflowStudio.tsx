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
  Pencil, Save, Play, Wand2, Globe, ArrowRight, Undo2, Redo2, FunctionSquare,
} from 'lucide-react';
import ExpressionEditor from '../__mockups__/ExpressionEditor';
import { CustomSelect } from '../../components/common/CustomSelect';
import { FilterBuilder } from '../../components/common/FilterBuilder';
import { DynamicIcon } from '../../components/common/DynamicIcon';
import type { FilterGroup, SailsTableDefinition } from '@sails/shared';
import { collectionValueSchema, validateCollectionValue } from '@sails/shared';
import { fetchCached } from '../../api/client';
import jsonata from 'jsonata';
import { useAuth } from '../../contexts/AuthContext';
import Unauthorized from '../Unauthorized';
import LoadingScreen from '../../components/common/LoadingScreen';
import { WorkflowEventWizard } from '../../components/workflow/WorkflowEventWizard';
import { VariableEditor } from '../../components/workflow/VariableEditor';
import type { WorkflowEventType as SharedWorkflowEventType } from '@sails/shared';
import './WorkflowStudio.css';

// ─── Types ────────────────────────────────────────────────────

type WorkflowEventType = 'record' | 'notification' | 'approval' | 'expression' | 'transform' | 'script';
type RouterType = 'user' | 'team' | 'position' | 'role' | 'field';
type LayoutMode = 'chain' | 'canvas';
type Port = 'top' | 'right' | 'bottom' | 'left';
type Timing = 'stage_enter' | 'stage_exit';

type CondBuilderTarget =
  | { kind: 'entry'; stageId: string }
  | { kind: 'branch'; stageId: string; branchId: string }
  | { kind: 'startBranch'; branchId: string };

interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  label: string;
  description?: string;
  timing?: Timing;
  config: Record<string, any>;
}

interface WorkflowVariable {
  id: string;
  name: string;
  fieldType: string;
  /** Record schema source: bound tenant model or inline custom fields. */
  schemaMode?: 'model' | 'custom';
  /** Collection items: 'record' | 'any' | scalar types. */
  itemType?: string;
  /** itemType === 'record' (or fieldType 'record') — the model the rows came from (physical table name). */
  targetModel?: string;
  /** Record schema snapshot (field name / label / type). */
  columns?: { fieldName: string; label?: string; logicalType?: string; targetModel?: string }[];
  /** The Record Event whose result populates this variable (structure owner). */
  boundEventId?: string;
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

const VAR_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'user', label: 'User' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'collection', label: 'Collection' },
  { value: 'record', label: 'Record' },
];

const VAR_TYPE_LABELS: Record<string, string> = Object.fromEntries(VAR_TYPES.map((t) => [t.value, t.label]));

/** Icon name + tint per variable type (icons from core FieldTypePlugin registry). */
const VAR_TYPE_ICON_NAMES: Record<string, string> = {
  text: 'Type',
  long_text: 'AlignLeft',
  number: 'Hash',
  decimal: 'Hash',
  date: 'Calendar',
  datetime: 'CalendarDays',
  time: 'Clock',
  user: 'UserCheck',
  boolean: 'ToggleLeft',
  collection: 'Layers',
  record: 'Database',
};

const VAR_TYPE_COLORS: Record<string, string> = {
  text: '#3b82f6',
  long_text: '#3b82f6',
  number: '#8b5cf6',
  decimal: '#8b5cf6',
  date: '#f59e0b',
  datetime: '#f59e0b',
  time: '#f59e0b',
  user: '#0ea5e5',
  boolean: '#10b981',
  collection: '#ec4899',
  record: '#3b82f6',
};

/** Scalar types usable inside a custom record schema. */
const VAR_FIELD_TYPES = VAR_TYPES.filter((t) => t.value !== 'collection' && t.value !== 'record').map((t) => t.value);

/** Legacy fieldType → canonical type (saved workflows). `boolean`/`relation` pass through. */
const LEGACY_VAR_TYPE_MAP: Record<string, string> = {
  short_text: 'text', rich_text: 'text', email: 'text', phone: 'text', select: 'text',
  currency: 'decimal', percentage: 'decimal', auto_number: 'number',
};

const normalizeVarType = (t: string): string => LEGACY_VAR_TYPE_MAP[t] || t;

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
  const base = { id, type, description: '' };
  switch (type) {
    case 'record': return { ...base, label: 'Record Event', config: { model: '', operation: 'read', storeToVariable: '' } };
    case 'notification': return { ...base, label: 'Notification', config: { channel: 'bell', recipients: '', subject: '', message: '' } };
    case 'approval': return { ...base, label: 'Task Approval', config: { routerType: 'role', routerValue: '', routerLabel: 'Approver', canApprove: true, canReject: true, timeoutHours: null } };
    case 'expression': return { ...base, label: 'Expression', config: { expression: '', assignToVariable: '' } };
    case 'transform': return { ...base, label: 'Transform', config: { expression: '', assignToVariable: '' } };
    case 'script': return { ...base, label: 'Script', config: { scriptId: '', scriptName: '', timeoutMs: 5000 } };
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
  return { id: genId('var'), name: '', fieldType: 'text' };
}

/** Summary row + f(x) button that opens the condition builder. */
function ConditionRow({
  value,
  emptyText,
  onOpen,
  onClear,
  disabled,
}: {
  value: string;
  emptyText: string;
  onOpen: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="ws-condition-row">
      <span className="ws-condition-summary">
        {value ? <code className="ws-entry-cond-code" title={value}>{value}</code> : emptyText}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {value && onClear && (
          <button className="ws-icon-btn" title="Clear condition" onClick={onClear} disabled={disabled}><X size={12} /></button>
        )}
        <button
          className="sails-btn sails-btn--ghost"
          onClick={onOpen}
          disabled={disabled}
          title="Open condition builder"
          aria-label="Open condition builder"
        >
          <FunctionSquare size={14} />
        </button>
      </span>
    </div>
  );
}

function emptyProcess(): RoutingProcess {
  return {
    name: '', description: '', tableId: null, triggerOn: [], triggerCondition: [], startMode: 'record',
    restConfig: { path: '', method: 'POST', headers: '', authToken: '', payloadExample: '' },
    scheduleConfig: { preset: 'custom', cron: '', timezone: 'UTC' },
    variables: [], startEvents: [], startBranches: [], stages: [],
  };
}

// ─── Undo / Redo history ─────────────────────────────────────

/** Deep-cloneable snapshot of the editor state (process + start node position). */
interface WorkflowSnapshot {
  process: RoutingProcess;
  startPos: Pt;
}

const HISTORY_MAX_ENTRIES = 50;
/** Rapid successive changes (typing, quick clicks) coalesce into one entry. */
const HISTORY_COALESCE_MS = 500;

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

/** Axis-aligned obstacle rectangle (a stage or the Start node). */
interface Rect { x: number; y: number; w: number; h: number; }

/** Clearance kept between a detoured edge and the obstacle it routes around. */
const OBSTACLE_MARGIN = 20;

function rectsIntersect(a: Pt, b: Pt, r: Rect): boolean {
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  return maxX > r.x && minX < r.x + r.w && maxY > r.y && minY < r.y + r.h;
}

function findBlocker(pts: Pt[], obstacles: Rect[]): { segIdx: number; rect: Rect } | null {
  // The first and last segments are the short port stubs at the nodes — they
  // legitimately touch the source/target rects, so they are never detoured.
  for (let i = 1; i < pts.length - 2; i++) {
    for (const r of obstacles) {
      if (rectsIntersect(pts[i], pts[i + 1], r)) return { segIdx: i, rect: r };
    }
  }
  return null;
}

function dedupePts(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

/**
 * Re-route the tail of an edge so the final approach never slices through the
 * target node. A plain orthogonal route enters left/right ports with a
 * horizontal leg at the port's height (the target's vertical center) — when
 * the source is above/below the target that leg crosses the stage body. The
 * same applies mirrored for top/bottom ports from a side source. This swings
 * the approach out to a gutter waypoint clear of the target and into the port.
 */
function normalizeTargetApproach(
  pts: Pt[],
  b: Pt, bW: number, bH: number,
  toPort: Port,
): Pt[] {
  if (pts.length < 4) return pts;
  const n = pts.length;
  const approach = pts[n - 3]; // bend before the entry stub
  const stubEnd = pts[n - 2];  // e1 — just outside the port
  const target: Rect = { x: b.x, y: b.y, w: bW, h: bH };
  if (!rectsIntersect(approach, stubEnd, target)) return pts; // approach is already clear

  const srcSide = pts[1]; // source stub end — indicates which side the source is on
  const portY = b.y + bH / 2;
  const portX = b.x + bW / 2;
  let tail: Pt[];
  if (toPort === 'left' || toPort === 'right') {
    const gutterX = toPort === 'left' ? b.x - OBSTACLE_MARGIN : b.x + bW + OBSTACLE_MARGIN;
    const levelY = srcSide.y <= b.y ? b.y - OBSTACLE_MARGIN : b.y + bH + OBSTACLE_MARGIN;
    tail = [
      { x: approach.x, y: levelY },
      { x: gutterX, y: levelY },
      { x: gutterX, y: portY },
    ];
  } else {
    const gutterY = toPort === 'top' ? b.y - OBSTACLE_MARGIN : b.y + bH + OBSTACLE_MARGIN;
    const levelX = srcSide.x <= b.x ? b.x - OBSTACLE_MARGIN : b.x + bW + OBSTACLE_MARGIN;
    tail = [
      { x: levelX, y: approach.y },
      { x: levelX, y: gutterY },
      { x: portX, y: gutterY },
    ];
  }
  return dedupePts([...pts.slice(0, n - 3), ...tail, pts[n - 1]]);
}

/**
 * Orthogonal route that avoids the given obstacle rectangles. Starts with the
 * plain orthogonal path; whenever a segment passes through an obstacle, the
 * segment is pushed to the obstacle's nearer side and the route is re-checked
 * (up to a few passes) so the line never crosses a stage.
 */
function routeOrthogonal(
  a: Pt, b: Pt, fromPort: Port, toPort: Port,
  aW: number, aH: number, bW: number, bH: number,
  obstacles: Rect[],
): Pt[] {
  let pts = orthogonalPoints(a, b, fromPort, toPort, aW, aH, bW, bH);
  // 1. Never slice through the target — swing the approach out to a gutter.
  pts = normalizeTargetApproach(pts, b, bW, bH, toPort);
  // 2. Route around every stage/Start node, including the edge's own source
  //    and target bodies (the port stubs are exempt inside findBlocker).
  const all: Rect[] = [
    ...obstacles,
    { x: a.x, y: a.y, w: aW, h: aH },
    { x: b.x, y: b.y, w: bW, h: bH },
  ];
  for (let pass = 0; pass < 4; pass++) {
    const blocker = findBlocker(pts, all);
    if (!blocker) break;
    const { segIdx, rect } = blocker;
    const p1 = pts[segIdx];
    const p2 = pts[segIdx + 1];
    const vertical = p1.x === p2.x;
    const insert: Pt[] = vertical
      ? [
        { x: (p1.x - (rect.x - OBSTACLE_MARGIN)) <= ((rect.x + rect.w + OBSTACLE_MARGIN) - p1.x)
            ? rect.x - OBSTACLE_MARGIN : rect.x + rect.w + OBSTACLE_MARGIN, y: p1.y },
        { x: (p1.x - (rect.x - OBSTACLE_MARGIN)) <= ((rect.x + rect.w + OBSTACLE_MARGIN) - p1.x)
            ? rect.x - OBSTACLE_MARGIN : rect.x + rect.w + OBSTACLE_MARGIN, y: p2.y },
      ]
      : [
        { x: p1.x, y: (p1.y - (rect.y - OBSTACLE_MARGIN)) <= ((rect.y + rect.h + OBSTACLE_MARGIN) - p1.y)
            ? rect.y - OBSTACLE_MARGIN : rect.y + rect.h + OBSTACLE_MARGIN },
        { x: p2.x, y: (p1.y - (rect.y - OBSTACLE_MARGIN)) <= ((rect.y + rect.h + OBSTACLE_MARGIN) - p1.y)
            ? rect.y - OBSTACLE_MARGIN : rect.y + rect.h + OBSTACLE_MARGIN },
      ];
    pts = dedupePts([...pts.slice(0, segIdx + 1), ...insert, ...pts.slice(segIdx + 1)]);
  }
  return pts;
}

/**
 * Pull both ends of a polyline back from the node ports by `trim` pixels.
 * Used as the invisible click band so ports stay grabbable while the rest of
 * the line keeps a wide hit area.
 */
function trimPolyline(pts: Pt[], trim = 12): Pt[] {
  if (pts.length <= 2) return pts;
  const start = pts[1];
  const dirStart = { x: Math.sign(start.x - pts[0].x) || 0, y: Math.sign(start.y - pts[0].y) || 0 };
  const end = pts[pts.length - 2];
  const last = pts[pts.length - 1];
  const dirEnd = { x: Math.sign(end.x - last.x) || 0, y: Math.sign(end.y - last.y) || 0 };
  return [
    { x: start.x - dirStart.x * trim, y: start.y - dirStart.y * trim },
    ...pts.slice(2, pts.length - 2),
    { x: end.x - dirEnd.x * trim, y: end.y - dirEnd.y * trim },
  ];
}

/** Midpoint along a polyline (for edge labels). */
function polylineMidpoint(pts: Pt[]): Pt {
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

  // ── Undo / Redo history ──
  const [undoStack, setUndoStack] = useState<WorkflowSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<WorkflowSnapshot[]>([]);
  const baselineRef = useRef<WorkflowSnapshot | null>(null);
  const historyReadyRef = useRef(false);        // arming after the initial fetch (or on new workflow)
  const justLoadedRef = useRef(false);          // one-shot: sync baseline without recording
  const suppressHistoryRef = useRef(false);     // one-shot: undo/redo applies themselves
  const gestureActiveRef = useRef(false);       // sticky: live drag gestures
  const pendingGestureRef = useRef<WorkflowSnapshot | null>(null); // pre-gesture snapshot, committed on first move
  const lastPushTimeRef = useRef(0);            // coalescing window anchor
  const isActiveStatus = def?.status === 'active';

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

  /**
   * QueryStudio Context-source options specific to workflows: requestor
   * drill-down macros and scalar workflow variables (@var.<name>), resolved
   * per instance at execution time by the Workflow Engine.
   */
  const workflowContextOptions = useMemo(() => {
    const scalarVars = process.variables.filter((v) => v.fieldType !== 'collection' && v.fieldType !== 'record');
    return [
      { value: 'cat_Workflow', label: '\u2500\u2500 Workflow \u2500\u2500', disabled: true },
      { value: '@wf.requestor', label: 'Requestor' },
      { value: '@wf.requestor.name', label: 'Requestor \u2192 Name' },
      { value: '@wf.requestor.email', label: 'Requestor \u2192 Email' },
      { value: '@wf.requestor.role', label: 'Requestor \u2192 Role' },
      { value: '@wf.requestor.title', label: 'Requestor \u2192 Job Title' },
      { value: '@wf.requestor.team', label: 'Requestor \u2192 Team' },
      { value: '@wf.requestor.position', label: 'Requestor \u2192 Position' },
      { value: '@wf.request_date', label: 'Request Date' },
      ...scalarVars.map((v) => ({ value: `@var.${v.name}`, label: `${v.name} (${VAR_TYPE_LABELS[v.fieldType] || v.fieldType})` })),
    ];
  }, [process.variables]);

  // API / UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [exprModalEventId, setExprModalEventId] = useState<string | null>(null);
  const [newVarOpen, setNewVarOpen] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('text');
  const [renameVarId, setRenameVarId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const commitRename = (varId: string) => {
    const name = renameDraft.trim();
    if (name) updateVariable(varId, { name });
    setRenameVarId(null);
  };
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [varEditorOpen, setVarEditorOpen] = useState(false);
  const [varModels, setVarModels] = useState<{ id: string; name: string; tableName: string; fields: any[] }[]>([]);
  const [confirmUpgradeVar, setConfirmUpgradeVar] = useState<{ eventId: string; varId: string; modelName: string } | null>(null);
  const [startConditionOpen, setStartConditionOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [recordFilterEventId, setRecordFilterEventId] = useState<string | null>(null);
  /** Config snapshot taken when the event wizard opens — restored on Cancel so
   * write-through edits don't survive an abandoned wizard session. */
  const [wizardSnapshot, setWizardSnapshot] = useState<Record<string, any> | null>(null);
  const [condBuilder, setCondBuilder] = useState<CondBuilderTarget | null>(null);
  // Drag-and-drop event reordering (chip currently being dropped onto).
  const [reorderTargetId, setReorderTargetId] = useState<string | null>(null);
  // Generic Workflow Event configuration wizard (schema-driven).
  const [wizardEventId, setWizardEventId] = useState<string | null>(null);
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
  /** Suppresses the deselect-click that follows a drag/pan/connect gesture. */
  const suppressCanvasClickRef = useRef(false);
  /** Whether the current pan gesture actually moved (distinguishes a click from a pan). */
  const panMovedRef = useRef(false);
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

  // Obstacle rects (stages + Start node) used to route lines around nodes.
  const edgeObstacles = useMemo(() => {
    const list: Rect[] = [];
    process.stages.forEach((s, idx) => {
      const p = stagePos(idx, s);
      list.push({ x: p.x, y: p.y, w: NODE_W, h: NODE_H });
    });
    list.push({ x: startNodePos.x, y: startNodePos.y, w: START_W, h: startNodeH });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process, layoutMode, startNodePos, startNodeH]);

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
            variables: (source.variables || []).map((v: any) => ({ ...v, fieldType: normalizeVarType(v.fieldType) })),
            startEvents: source.startEvents || [],
            startBranches: source.startBranches || [],
            stages: source.stages || [],
          });
        } else {
          setProcess((p) => ({ ...p, name: d.name, description: d.description || '', tableId: d.tableId || null } as any));
        }
      }).catch((e) => setError(e.message)).finally(() => {
        setLoading(false);
        // Arm undo/redo only after the fetched config has been fanned out, so
        // the initial load never records a phantom "empty workflow" entry.
        historyReadyRef.current = true;
        justLoadedRef.current = true;
      });
    // eslint-disable-next-line
  }, [workflowId]);

  // New (unsaved) workflow: arm history immediately so edits are tracked.
  useEffect(() => {
    if (!workflowId) {
      historyReadyRef.current = true;
      justLoadedRef.current = true;
    }
  }, [workflowId]);

  // ── Keyboard ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

      // Undo / Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y.
      // Skipped while typing so the browser handles native text undo.
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !isTyping && !editingLabelId && !isActiveStatus) {
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

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (isTyping) return;
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
  }, [selectedStageId, selectedEventId, selectedEdgeId, selectedStart, editingLabelId, process, undoStack, redoStack, isActiveStatus]);

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
  const updateEventDescription = (stageId: string, eventId: string, description: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, description } : e)) } : s)) }));
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
  const updateStartEventDescription = (eventId: string, description: string) => {
    setProcess((p) => ({ ...p, startEvents: p.startEvents.map((e) => (e.id === eventId ? { ...e, description } : e)) }));
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
  /** Open the platform-standard configuration wizard directly (one click after double-click). */
  const openEventWizard = (eventId: string) => {
    const host = resolveEventHost(eventId);
    if (!host) return;
    // Snapshot the committed config so Cancel can roll back write-through edits.
    const ev = host.kind === 'start'
      ? process.startEvents.find((e) => e.id === eventId)
      : process.stages.find((s) => s.id === host.stageId)?.events.find((e) => e.id === eventId);
    setWizardSnapshot(ev ? JSON.parse(JSON.stringify(ev.config || {})) : null);
    setSelectedEventId(eventId);
    setWizardEventId(eventId);
    if (host.kind === 'start') {
      setSelectedStart(true);
      setSelectedStageId(null);
    } else {
      setSelectedStageId(host.stageId);
      setSelectedStart(false);
    }
    setSelectedEdgeId(null);
  };

  /** Write-through: a wizard parameter edit lands directly in the live config. */
  const updateLiveEventConfig = (eventId: string, name: string, value: any) => {
    const h = resolveEventHost(eventId);
    if (!h) return;
    if (h.kind === 'start') updateStartEventConfig(eventId, { [name]: value });
    else updateEventConfig(h.stageId, eventId, { [name]: value });
  };

  const closeWizard = () => { setWizardSnapshot(null); setWizardEventId(null); };

  /** Replace an event's config wholesale (used to roll back a canceled wizard). */
  const replaceEventConfig = (eventId: string, config: Record<string, any>) => {
    const host = resolveEventHost(eventId);
    if (!host) return;
    if (host.kind === 'start') {
      setProcess((p) => ({ ...p, startEvents: p.startEvents.map((e) => (e.id === eventId ? { ...e, config } : e)) }));
    } else {
      setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === host.stageId ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, config } : e)) } : s)) }));
    }
  };

  // ── Drag-and-drop event reordering ──
  const handleEventDragStart = (e: React.DragEvent, eventId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ev-reorder', eventId }));
    e.dataTransfer.effectAllowed = 'move';
    setReorderTargetId(null);
  };

  const handleEventDragOver = (e: React.DragEvent, targetEventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setReorderTargetId(targetEventId);
  };

  const handleEventDragLeave = (e: React.DragEvent, targetEventId: string) => {
    if (reorderTargetId === targetEventId) setReorderTargetId(null);
  };

  /** Reorder the dragged event to the drop target's slot (same host required). */
  const handleEventReorderDrop = (e: React.DragEvent, targetEventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setReorderTargetId(null);
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const p = JSON.parse(payload);
      if (p.type !== 'ev-reorder' || !p.eventId || p.eventId === targetEventId) return;
      const fromId: string = p.eventId;
      const host = resolveEventHost(fromId);
      const targetHost = resolveEventHost(targetEventId);
      if (!host || !targetHost) return;
      if (host.kind !== targetHost.kind) return;
      if (host.kind === 'stage' && targetHost.kind === 'stage' && host.stageId !== targetHost.stageId) return;

      setProcess((proc) => {
        const arr = host.kind === 'start'
          ? proc.startEvents
          : (proc.stages.find((s) => s.id === host.stageId)?.events || []);
        const from = arr.findIndex((ev) => ev.id === fromId);
        const to = arr.findIndex((ev) => ev.id === targetEventId);
        if (from === -1 || to === -1 || from === to) return proc;
        const next = [...arr];
        const [moved] = next.splice(from, 1);
        next.splice(from < to ? to - 1 : to, 0, moved);
        if (host.kind === 'start') return { ...proc, startEvents: next };
        return { ...proc, stages: proc.stages.map((s) => (s.id === host.stageId ? { ...s, events: next } : s)) };
      });
    } catch { /* ignore */ }
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
    const v: WorkflowVariable = { ...newVariable(), name: name.trim(), fieldType };
    if (fieldType === 'collection') {
      v.itemType = 'any';
      v.defaultValue = [];
    } else if (fieldType === 'record') {
      v.schemaMode = 'model';
      v.defaultValue = {};
    }
    setProcess((p) => ({ ...p, variables: [...p.variables, v] }));
    setSelectedVarId(v.id);
    setNewVarOpen(false); setNewVarName(''); setNewVarType('text');
  };
  const updateVariable = (varId: string, patch: Partial<WorkflowVariable>) => {
    setProcess((p) => ({ ...p, variables: p.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)) }));
  };
  const removeVariable = (varId: string) => {
    setProcess((p) => ({ ...p, variables: p.variables.filter((v) => v.id !== varId) }));
    if (selectedVarId === varId) setSelectedVarId(null);
  };

  type StrictColumn = { fieldName: string; label: string; logicalType: string; targetModel?: string };
  const columnsFromModel = (model: { id: string; name: string; tableName: string; fields: any[] }): StrictColumn[] =>
    (model.fields || []).map((f) => ({
      fieldName: f.fieldName ?? f.columnName ?? f.id,
      label: f.name ?? f.label ?? f.fieldName,
      logicalType: f.logicalType ?? f.physicalType ?? 'text',
      targetModel: (f.logicalType === 'relation' || f.logicalType === 'lookup')
        ? (f.config?.targetTable ?? f.config?.targetModel ?? undefined)
        : undefined,
    }));

  const loadVarModels = async () => {
    try {
      const res = await fetch('/api/metadata/objects');
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []);
      if (Array.isArray(rows)) {
        setVarModels(rows.map((t: any) => ({
          id: t.id,
          name: t.name,
          tableName: t.tableName,
          fields: Array.isArray(t.fields) ? t.fields : [],
        })));
      }
    } catch { /* model list is best-effort */ }
  };

  useEffect(() => { loadVarModels(); }, []);

  /** Suggestion payload for the expression editors (schema included for records). */
  const varSuggestProps = process.variables.map((v) => ({
    id: v.id, name: v.name, fieldType: v.fieldType,
    targetModel: v.targetModel,
    columns: (v.columns || []).map((c) => ({
      fieldName: c.fieldName,
      label: c.label || c.fieldName,
      logicalType: c.logicalType || 'text',
      ...(c.targetModel ? { targetModel: c.targetModel } : {}),
    })),
  }));

  /** Model tableName → columns map for multi-level record drill-down. */
  const recordSchemas: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]> = {};
  for (const m of varModels) recordSchemas[m.tableName] = columnsFromModel(m);

  const sampleForType = (t: string): any =>
    ['number', 'decimal', 'currency', 'percentage'].includes(t) ? 0 : t === 'boolean' ? false : '';

  /** Build a representative sample value for Test runs (nested records included). */
  const sampleForVariable = (v: WorkflowVariable): any => {
    if (v.fieldType === 'collection') {
      if (v.itemType === 'record' && v.columns?.length) {
        const row: Record<string, any> = {};
        for (const c of v.columns) row[c.fieldName] = sampleForType(c.logicalType || 'text');
        return [row];
      }
      return [];
    }
    if (v.fieldType === 'record') {
      const rec: Record<string, any> = {};
      for (const c of v.columns || []) rec[c.fieldName] = sampleForType(c.logicalType || 'text');
      return rec;
    }
    if (v.fieldType === 'number' || v.fieldType === 'decimal') return v.defaultValue ?? 0;
    if (v.fieldType === 'boolean') return v.defaultValue ?? false;
    return v.defaultValue ?? '';
  };

  const varSample = Object.fromEntries(process.variables.filter((v) => v.name).map((v) => [v.name, sampleForVariable(v)]));

  const varTypeLabel = (v: WorkflowVariable): string => VAR_TYPE_LABELS[v.fieldType] || v.fieldType;

  // ── Record Event ⇄ variable binding ──
  const bindVariableToEvent = (varId: string, eventId: string, modelName: string) => {
    const model = varModels.find((m) => m.tableName === modelName || m.name === modelName || m.id === modelName);
    updateVariable(varId, {
      fieldType: 'collection',
      itemType: 'record',
      targetModel: modelName,
      columns: model ? columnsFromModel(model) : undefined,
      boundEventId: eventId,
    });
  };

  const handleStoreToVariableChange = (eventId: string, varName: string, modelName: string) => {
    if (!varName) {
      const bound = process.variables.find((v) => v.boundEventId === eventId);
      if (bound) updateVariable(bound.id, { boundEventId: undefined });
      return;
    }
    const target = process.variables.find((v) => v.name === varName);
    if (!target) return; // partial name while typing — nothing to bind yet
    if (target.fieldType === 'collection') {
      bindVariableToEvent(target.id, eventId, modelName);
    } else {
      setConfirmUpgradeVar({ eventId, varId: target.id, modelName });
    }
  };

  /** Bidirectional sync: variable model change rewrites Record Events that store into it. */
  const handleVarModelChange = (varId: string, modelName: string) => {
    const v = process.variables.find((x) => x.id === varId);
    const m = varModels.find((x) => x.tableName === modelName || x.name === modelName);
    updateVariable(varId, { targetModel: modelName || undefined, columns: m ? columnsFromModel(m) : undefined });
    if (!v || !modelName) return;
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => ({
        ...s,
        events: s.events.map((ev) =>
          ev.type === 'record' && ev.config.storeToVariable === v.name
            ? { ...ev, config: { ...ev.config, model: modelName, filterGroups: [] } }
            : ev,
        ),
      })),
      startEvents: p.startEvents.map((ev) =>
        ev.type === 'record' && ev.config.storeToVariable === v.name
          ? { ...ev, config: { ...ev.config, model: modelName, filterGroups: [] } }
          : ev,
      ),
    }));
  };

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
    beginGesture();
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
    beginGesture();
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
    beginGesture();
    setDraggingEdgePort({ branchId, side });
  };

  const handleWorldPointerMove = (e: React.PointerEvent) => {
    // Background pan (Canvas mode): drag the empty canvas to scroll the viewport.
    if (panning) {
      panMovedRef.current = true;
      const canvas = worldRef.current?.closest('.ws-canvas') as HTMLElement | null;
      if (canvas) {
        canvas.scrollLeft = panning.scrollLeft - (e.clientX - panning.startX);
        canvas.scrollTop = panning.scrollTop - (e.clientY - panning.startY);
      }
      return;
    }
    // First real movement of a drag gesture: commit the pre-gesture snapshot
    // as a single undo step (subsequent moves are suppressed by gestureActive).
    commitGestureIfMoved();
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
    panMovedRef.current = false;
    setPanning({ startX: e.clientX, startY: e.clientY, scrollLeft: canvas.scrollLeft, scrollTop: canvas.scrollTop });
  };

  const handleWorldPointerUp = (e?: React.PointerEvent) => {
    if (e && worldRef.current?.hasPointerCapture(e.pointerId)) {
      worldRef.current.releasePointerCapture(e.pointerId);
    }
    // A gesture just ended — the following click would otherwise retarget to the
    // canvas and clear the selection. Consume it in the canvas onClick handler.
    // Only a real gesture (drag/connect/pan that actually moved) suppresses the
    // click — a plain click must still deselect so the Workflow properties show.
    if (dragging || draggingEdgePort || connectFrom || panMovedRef.current) {
      suppressCanvasClickRef.current = true;
    }
    setDragging(null); setDraggingEdgePort(null); setConnectFrom(null); setConnectPos(null);
    chainDragRef.current = null;
    setChainDragY(null);
    setPanning(null);
    endGesture();
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

  // ── Undo / Redo engine ──

  const makeSnapshot = (): WorkflowSnapshot => ({
    process: JSON.parse(JSON.stringify(process)),
    startPos: { ...startPos },
  });

  /** Restore a snapshot into the editor state (mirrors the load fan-out). */
  const applySnapshot = (snap: WorkflowSnapshot) => {
    setProcess(JSON.parse(JSON.stringify(snap.process)));
    setStartPos({ ...snap.startPos });
    setSelectedStageId(null);
    setSelectedEventId(null);
    setSelectedEdgeId(null);
    setSelectedStart(false);
    setEditingLabelId(null);
  };

  /** Start of a live drag gesture: snapshot pre-gesture state, suppress the watch effect. */
  const beginGesture = () => {
    gestureActiveRef.current = true;
    pendingGestureRef.current = makeSnapshot();
  };

  /** First actual pointer move: commit the pre-gesture snapshot as one undo step. */
  const commitGestureIfMoved = () => {
    if (!pendingGestureRef.current) return;
    const snap = pendingGestureRef.current;
    pendingGestureRef.current = null;
    setUndoStack((s) => [...s, snap].slice(-HISTORY_MAX_ENTRIES));
    setRedoStack([]);
  };

  /** End of a drag gesture: discard an untouched pending snapshot, re-arm the watch effect. */
  const endGesture = () => {
    pendingGestureRef.current = null;
    gestureActiveRef.current = false;
  };

  // Watch effect: runs after every render, cheap JSON diff against the
  // baseline. Pushes a history entry only when the editor state actually
  // changed. One-shot flags prevent the load / undo / redo applications
  // themselves from being recorded.
  useEffect(() => {
    const snap = makeSnapshot();
    if (!historyReadyRef.current || justLoadedRef.current || suppressHistoryRef.current || gestureActiveRef.current) {
      if (justLoadedRef.current) justLoadedRef.current = false;
      if (suppressHistoryRef.current) suppressHistoryRef.current = false;
      baselineRef.current = snap;
      return;
    }
    const prev = baselineRef.current;
    if (prev && JSON.stringify(prev) !== JSON.stringify(snap)) {
      const now = Date.now();
      const coalescing = now - lastPushTimeRef.current < HISTORY_COALESCE_MS;
      setUndoStack((s) => {
        const next = coalescing && s.length > 0 ? [...s.slice(0, -1), prev] : [...s, prev];
        lastPushTimeRef.current = now;
        return next.slice(-HISTORY_MAX_ENTRIES);
      });
      setRedoStack([]);
    }
    baselineRef.current = snap;
  });

  const handleUndo = () => {
    if (isActiveStatus || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, makeSnapshot()]);
    suppressHistoryRef.current = true;
    applySnapshot(prev);
  };

  const handleRedo = () => {
    if (isActiveStatus || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, makeSnapshot()]);
    suppressHistoryRef.current = true;
    applySnapshot(next);
  };

  const canUndo = undoStack.length > 0 && !isActiveStatus;
  const canRedo = redoStack.length > 0 && !isActiveStatus;

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
      if (source?.stages) setProcess({ ...process, stages: source.stages, variables: (source.variables || []).map((v: any) => ({ ...v, fieldType: normalizeVarType(v.fieldType) })), startEvents: source.startEvents || [], startBranches: source.startBranches || [], triggerOn: source.triggerOn || [], triggerCondition: source.triggerCondition || [], startMode: source.startMode || 'record', restConfig: { path: '', method: 'POST', headers: '', authToken: '', payloadExample: '', ...(source.restConfig || {}) }, scheduleConfig: { preset: 'custom', cron: '', timezone: 'UTC', ...(source.scheduleConfig || {}) } } as any);
      setSavedMsg('Draft discarded — reverted to published version');
    } catch (e: any) { setSaveError(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  // ── Auth guard ──
  if (!allowedRoles.includes(user?.role || '')) return <Unauthorized />;

  // ── Render: Properties Panel ──────────────────────────────────
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
            <div key={ev.id} className={`ws-event-chip ws-event-chip--list ${isSel ? 'ws-event-chip--selected' : ''}${reorderTargetId === ev.id ? ' ws-event-chip--drop-target' : ''}`}
              style={{ borderColor: d?.color, color: d?.color, margin: '2px 12px', cursor: 'pointer' }}
              draggable
              onClick={() => setSelectedEventId(isSel ? null : ev.id)}
              onDoubleClick={(e) => { e.stopPropagation(); openEventWizard(ev.id); }}
              onDragStart={(e) => handleEventDragStart(e, ev.id)}
              onDragOver={(e) => handleEventDragOver(e, ev.id)}
              onDragLeave={(e) => handleEventDragLeave(e, ev.id)}
              onDrop={(e) => handleEventReorderDrop(e, ev.id)}
              onDragEnd={() => setReorderTargetId(null)}
              title="Drag to reorder · double-click to edit"
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
        <div className="ws-props-group">
          <label className="ws-props-label">Display Name</label>
          <input className="ws-props-input" value={process.name} onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))} disabled={isReadonly} />
        </div>
        <div className="ws-props-group">
          <label className="ws-props-label">Description</label>
          <textarea className="ws-props-input ws-props-textarea" value={process.description || ''} onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))} disabled={isReadonly} rows={2} />
        </div>
        <div className="ws-props-section-title">Start Condition</div>
        <div className="ws-props-group">
          <p className="ws-props-hint" style={{ paddingTop: 0 }}>
            {TRIGGER_OPS.find((o) => o.value === triggerOpOf(process.triggerOn))?.label || 'Inserted Or Updated'}
            {triggerRuleCount(process.triggerCondition) > 0 && ` · ${triggerRuleCount(process.triggerCondition)} rule${triggerRuleCount(process.triggerCondition) > 1 ? 's' : ''}`}
            <span style={{ marginLeft: 6 }}>— configure in Start Condition.</span>
          </p>
        </div>
        <p className="ws-props-hint">Both API-triggered and model-triggered starts are supported.</p>

        <div className="ws-props-section-title ws-var-section-head">
          <span className="ws-var-section-head__title"><Hash size={11} /> Variables ({process.variables.length})</span>
          <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setNewVarOpen(true)} disabled={isReadonly}>
            <Plus size={12} /> Add Variable
          </button>
          {newVarOpen && (
            <div className="ws-var-add-pop" onClick={(e) => e.stopPropagation()}>
              <label className="ws-props-label">Name</label>
              <input
                className="ws-props-input"
                autoFocus
                placeholder="Variable name"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newVarName.trim()) { addVariable(newVarName, newVarType); setNewVarOpen(false); } if (e.key === 'Escape') setNewVarOpen(false); }}
              />
              <label className="ws-props-label" style={{ marginTop: 4 }}>Type</label>
              <CustomSelect
                searchable
                value={newVarType}
                options={VAR_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(v) => setNewVarType(String(v))}
              />
              <div className="ws-var-add-pop__footer">
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setNewVarOpen(false)}>Cancel</button>
                <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!newVarName.trim()}
                  onClick={() => { addVariable(newVarName, newVarType); setNewVarOpen(false); }}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
        {process.variables.length === 0 && <p className="ws-props-hint">Workflow variables are shared across events, branches and scripts.</p>}
        {process.variables.map((v) => {
          const isSel = selectedVarId === v.id;
          const color = VAR_TYPE_COLORS[v.fieldType] || '#3b82f6';
          const isRenaming = renameVarId === v.id;
          return (
            <div key={v.id} className={`ws-event-chip ws-event-chip--list ${isSel ? 'ws-event-chip--selected' : ''}`}
              style={{ borderColor: color, color, margin: '2px 12px', cursor: 'pointer' }}
              onClick={() => setSelectedVarId(isSel ? null : v.id)}
              onDoubleClick={(e) => { e.stopPropagation(); setSelectedVarId(v.id); setVarEditorOpen(true); }}
              title="Click to select · double-click to edit"
            >
              <DynamicIcon name={VAR_TYPE_ICON_NAMES[v.fieldType] || 'Hash'} size={10} />
              {isRenaming ? (
                <input
                  className="ws-props-input ws-var-rename-input"
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(v.id);
                    if (e.key === 'Escape') setRenameVarId(null);
                  }}
                />
              ) : (
                <span className="ws-var-row__name" onDoubleClick={(e) => { e.stopPropagation(); if (!isReadonly) { setRenameVarId(v.id); setRenameDraft(v.name || ''); } }}>
                  {v.name || <em>unnamed</em>}
                </span>
              )}
              <span className="ws-var-row__type">{varTypeLabel(v)}</span>
              {v.boundEventId && <span className="ws-var-row__bound" title="Bound to a Record Event">↗ ev</span>}
              <button className="ws-var-row__remove" title="Remove variable" onClick={(e) => { e.stopPropagation(); removeVariable(v.id); }}><X size={10} /></button>
            </div>
          );
        })}

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
      return (
        <div className="ws-properties">
          <div className="ws-props-header">
            <span className="ws-panel-title"><GitBranch size={12} /> Stage Properties</span>
            <button className="ws-props-header__float" onClick={() => setPropsFloating(!propsFloating)} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>{propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}</button>
          </div>
          <div className="ws-props-section-title">Name</div>
          <div className="ws-props-group"><input className="ws-props-input" value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} disabled={isReadonly} /></div>

          <div className="ws-props-section-title">Entry Condition</div>
          <div className="ws-props-group">
            <ConditionRow
              value={s.entryCondition}
              emptyText="No condition — always entered"
              onOpen={() => setCondBuilder({ kind: 'entry', stageId: s.id })}
              onClear={() => updateStage(s.id, { entryCondition: '' })}
              disabled={isReadonly}
            />
            <p className="ws-props-hint" style={{ paddingTop: 2 }}>The stage is entered only when the JSONata condition evaluates to true.</p>
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
              <ConditionRow
                value={br.expression}
                emptyText="No condition — always taken"
                onOpen={() => setCondBuilder({ kind: 'startBranch', branchId: br.id })}
                onClear={() => updateStartBranch(br.id, { expression: '' })}
                disabled={isReadonly}
              />
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
              <ConditionRow
                value={startBr.expression}
                emptyText="No condition — always taken"
                onOpen={() => setCondBuilder({ kind: 'startBranch', branchId: startBr.id })}
                onClear={() => updateStartBranch(startBr.id, { expression: '' })}
                disabled={isReadonly}
              />
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
            <ConditionRow
              value={br.expression}
              emptyText="No condition — always taken"
              onOpen={() => setCondBuilder({ kind: 'branch', stageId: owner.id, branchId: br.id })}
              onClear={() => updateBranch(owner.id, br.id, { expression: '' })}
              disabled={isReadonly}
            />
            <p className="ws-props-hint" style={{ paddingTop: 2 }}>Empty condition routes by default; first truthy branch wins.</p>
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
          {s.events.length === 0 ? <span className="ws-stage__events-empty">Drop a Workflow Event here</span> : s.events.slice(0, 6).map((ev) => {
            const def = EVENT_DEFS.find((d) => d.type === ev.type);
            const isEvSel = selectedEventId === ev.id && isSel;
            return <span key={ev.id} className={`ws-event-chip ws-event-chip--icon ${isEvSel ? 'ws-event-chip--selected' : ''}${reorderTargetId === ev.id ? ' ws-event-chip--drop-target' : ''}`} style={{ borderColor: def?.color, color: def?.color }} title={`${ev.label} — drag to reorder`} draggable onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSelectedStageId(s.id); setSelectedEventId(isEvSel ? null : ev.id); }} onDoubleClick={(e) => { e.stopPropagation(); openEventWizard(ev.id); }} onDragStart={(e) => handleEventDragStart(e, ev.id)} onDragOver={(e) => handleEventDragOver(e, ev.id)} onDragLeave={(e) => handleEventDragLeave(e, ev.id)} onDrop={(e) => handleEventReorderDrop(e, ev.id)} onDragEnd={() => setReorderTargetId(null)}>{def?.icon}</span>;
          })}
          {s.events.length > 6 && <span className="ws-stage__events-more">+{s.events.length - 6}</span>}
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

  // ── Render: generic Workflow Event configuration wizard ──
  const renderEventWizard = () => {
    if (!wizardEventId) return null;
    const host = resolveEventHost(wizardEventId);
    const ev = host
      ? host.kind === 'start'
        ? process.startEvents.find((e) => e.id === wizardEventId) || null
        : (process.stages.find((s) => s.id === host.stageId)?.events.find((e) => e.id === wizardEventId) || null)
      : null;
    if (!ev) return null;

    const createCollectionVariable = (name: string, modelTableName: string): string => {
      const existing = process.variables.find((v) => v.name === name);
      if (existing) return existing.id;
      const modelTable = tables.find((t) => t.tableName === modelTableName);
      const varId = genId('var');
      setProcess((p) => ({
        ...p,
        variables: [...p.variables, {
          id: varId, name, fieldType: 'collection', itemType: 'record',
          targetModel: modelTableName,
          columns: modelTable ? columnsFromModel(modelTable as any) : [],
        }],
      }));
      return varId;
    };

    return (
      <WorkflowEventWizard
        key={wizardEventId}
        eventId={wizardEventId}
        eventType={ev.type as SharedWorkflowEventType}
        config={ev.config || {}}
        label={ev.label}
        onLabelChange={(l) => {
          const h = resolveEventHost(wizardEventId);
          if (h?.kind === 'start') updateStartEventLabel(wizardEventId, l);
          else if (h?.kind === 'stage') updateEventLabel(h.stageId, wizardEventId, l);
        }}
        description={ev.description || ''}
        onDescriptionChange={(d) => {
          const h = resolveEventHost(wizardEventId);
          if (h?.kind === 'start') updateStartEventDescription(wizardEventId, d);
          else if (h?.kind === 'stage') updateEventDescription(h.stageId, wizardEventId, d);
        }}
        variables={process.variables}
        tables={tables}
        onCreateCollectionVariable={createCollectionVariable}
        onBindVariableToEvent={bindVariableToEvent}
        onOpenExpressionEditor={(id) => setExprModalEventId(id)}
        onOpenFilterBuilder={(id) => setRecordFilterEventId(id)}
        columnsFromModel={(m: any) => columnsFromModel(m)}
        onConfigChange={(name, value) => updateLiveEventConfig(wizardEventId, name, value)}
        onDone={closeWizard}
        onRemove={(id) => {
          const h = resolveEventHost(id);
          if (h?.kind === 'start') { removeStartEvent(id); closeWizard(); }
          else if (h?.kind === 'stage') { removeEvent(h.stageId, id); closeWizard(); }
        }}
        onClose={() => {
          // Cancel: roll the write-through edits back to the snapshot (replace,
          // not merge — keys added during the session are dropped too).
          if (wizardSnapshot) replaceEventConfig(wizardEventId, wizardSnapshot);
          closeWizard();
        }}
      />
    );
  };

  // ── Render: Expression/Transform Modal ──
  const renderExprModal = () => {
    if (!exprModalEvent) return null;
    const def = EVENT_DEFS.find((d) => d.type === exprModalEvent.type);
    const sample = varSample;
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
            <ExpressionEditor showSnippets variables={varSuggestProps} recordSchemas={recordSchemas} value={exprModalEvent.config.expression || ''} onChange={onApply} sample={sample} />
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
  const isReadonly = isActive;

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
        {def && <span className={`ws-toolbar__status ws-toolbar__status--${def.status}`}>{def.status}</span>}

        <div className="ws-mode-toggle">
          <button className={`ws-mode-btn ${layoutMode === 'chain' ? 'ws-mode-btn--active' : ''}`} onClick={() => setLayoutMode('chain')}><ChevronsUpDown size={13} /> Simple</button>
          <button className={`ws-mode-btn ${layoutMode === 'canvas' ? 'ws-mode-btn--active' : ''}`} onClick={() => setLayoutMode('canvas')}><Layers size={13} /> Canvas</button>
        </div>

        <div className="ws-toolbar__actions">
          {!isActive && (
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
                <Undo2 size={14} />
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
                <Redo2 size={14} />
              </button>
              <span className="ws-toolbar__divider" />
            </>
          )}
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
          <div className={`ws-canvas ${layoutMode === 'canvas' ? 'ws-canvas--canvas' : ''}${panning ? ' ws-canvas--panning' : ''}`} onClick={() => {
            if (suppressCanvasClickRef.current) { suppressCanvasClickRef.current = false; return; }
            setSelectedStageId(null); setSelectedEventId(null); setSelectedEdgeId(null); setSelectedStart(false);
          }}>
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
                // Route around every stage/Start node except this edge's own endpoints.
                const selfRects: Rect[] = [
                  { x: e.a.x, y: e.a.y, w: aW, h: aH },
                  { x: e.b.x, y: e.b.y, w: NODE_W, h: NODE_H },
                ];
                const obs = edgeObstacles.filter((r) =>
                  !selfRects.some((s) => s.x === r.x && s.y === r.y && s.w === r.w && s.h === r.h));
                const pts = routeOrthogonal(e.a, e.b, e.fromPort, e.toPort, aW, aH, NODE_W, NODE_H, obs);
                const pathD = roundedOrthogonalPath(pts);
                const mid = polylineMidpoint(pts);
                return (
                  <g key={e.id} className={`ws-edge ${isSel ? 'ws-edge--selected' : ''}`}>
                    {/* Wide invisible hit path — makes the line easy to click.
                        Ends are trimmed so the node ports stay grabbable. */}
                    <path
                      d={roundedOrthogonalPath(trimPolyline(pts))}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                      className="ws-edge-hit"
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedEdgeId(e.branchId || null);
                        if (e.sourceStageId) setSelectedStageId(e.sourceStageId);
                      }}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={isSel ? 3 : 2}
                      markerEnd="url(#ws-arrow-branch)"
                      className="ws-edge-path--clickable"
                      onPointerDown={(ev) => ev.stopPropagation()}
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
                        onDoubleClick={(e) => { e.stopPropagation(); openEventWizard(ev.id); }}
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
      {/* Generic Workflow Event Wizard */}
      {renderEventWizard()}

      {/* Expression/Transform Modal */}
      {renderExprModal()}

      {/* JSONata Condition Builder (Entry Condition / Branch Condition) */}
      {condBuilder && (() => {
        const sample = varSample;
        const target = condBuilder.kind === 'entry'
          ? { stage: process.stages.find((st) => st.id === condBuilder.stageId) }
          : condBuilder.kind === 'branch'
            ? { stage: process.stages.find((st) => st.id === condBuilder.stageId), branch: process.stages.find((st) => st.id === condBuilder.stageId)?.branches.find((b) => b.id === condBuilder.branchId) }
            : { branch: process.startBranches.find((b) => b.id === condBuilder.branchId) };
        const hostName = target.stage?.name || '';
        const label = condBuilder.kind === 'entry' ? 'Entry Condition' : condBuilder.kind === 'branch' ? 'Branch Condition' : 'Start Branch Condition';
        const branchLabel = condBuilder.kind !== 'entry' ? (target.branch?.label || '') : '';
        const value = condBuilder.kind === 'entry'
          ? (target.stage?.entryCondition || '')
          : (target.branch?.expression || '');
        if (condBuilder.kind === 'entry' && !target.stage) { setCondBuilder(null); return null; }
        if (condBuilder.kind !== 'entry' && !target.branch) { setCondBuilder(null); return null; }
        const onApply = (v: string) => {
          if (condBuilder.kind === 'entry') updateStage(condBuilder.stageId, { entryCondition: v });
          else if (condBuilder.kind === 'branch') updateBranch(condBuilder.stageId, condBuilder.branchId, { expression: v });
          else updateStartBranch(condBuilder.branchId, { expression: v });
        };
        return (
          <div className="ws-modal-overlay" onClick={() => setCondBuilder(null)}>
            <div className="ws-modal ws-event-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><FunctionSquare size={16} /></span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">{label}</span>
                  <span className="ws-modal__sub">{hostName ? `${hostName} · ` : ''}{branchLabel ? `${branchLabel} · ` : ''}Condition builder</span>
                </div>
                <button className="ws-icon-btn" onClick={() => setCondBuilder(null)}><X size={15} /></button>
              </div>
              <div className="ws-modal__body">
                <ExpressionEditor
                  showSnippets
                  variables={varSuggestProps} recordSchemas={recordSchemas}
                  value={value}
                  onChange={onApply}
                  sample={sample}
                />
                <p className="ws-props-hint">Returns a truthy value → condition passes. Use <strong>Test</strong> to evaluate against workflow variables.</p>
              </div>
              <div className="ws-modal__footer">
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setCondBuilder(null)}>Cancel</button>
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setCondBuilder(null)}><CheckCircle2 size={14} /> Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Variable editor popup (double-click a variable chip) */}
      {varEditorOpen && selectedVarId && (() => {
        const v = process.variables.find((x) => x.id === selectedVarId);
        if (!v) return null;
        return (
          <div className="ws-modal-overlay" onClick={() => setVarEditorOpen(false)}>
            <div className="ws-modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ background: 'rgba(236,72,153,.12)', color: '#ec4899' }}><Database size={16} /></span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">Variable — {v.name || 'unnamed'}</span>
                  <span className="ws-modal__sub">{varTypeLabel(v)}</span>
                </div>
                <button className="ws-icon-btn" onClick={() => setVarEditorOpen(false)}><X size={15} /></button>
              </div>
              <div className="ws-modal__body" style={{ padding: 0 }}>
                <VariableEditor
                  variable={v}
                  models={varModels}
                  isReadonly={isReadonly}
                  onChange={(patch) => updateVariable(v.id, patch)}
                  onReloadModels={loadVarModels}
                />
              </div>
              <div className="ws-modal__footer">
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setVarEditorOpen(false)}>
                  <CheckCircle2 size={14} /> Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Variable upgrade confirm (Record Event → non-collection variable) */}
      {confirmUpgradeVar && (() => {
        const target = process.variables.find((v) => v.id === confirmUpgradeVar.varId);
        return (
          <div className="ws-modal-overlay" onClick={() => setConfirmUpgradeVar(null)}>
            <div className="ws-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ background: 'rgba(245,158,11,.12)', color: '#d97706' }}><AlertTriangle size={16} /></span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">Convert variable to collection?</span>
                  <span className="ws-modal__sub">The Record Event result will be stored into it</span>
                </div>
                <button className="ws-icon-btn" onClick={() => setConfirmUpgradeVar(null)}><X size={15} /></button>
              </div>
              <div className="ws-modal__body">
                <p className="ws-props-hint" style={{ paddingTop: 0 }}>
                  <strong>{target?.name || 'This variable'}</strong> is currently a <code>{target?.fieldType || '?'}</code> variable.
                  A Record Event returns rows and columns — it will be converted to{' '}
                  <code>collection&lt;record: {confirmUpgradeVar.modelName}&gt;</code> with columns generated from the model.
                </p>
              </div>
              <div className="ws-modal__footer">
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setConfirmUpgradeVar(null)}>Cancel</button>
                <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => {
                  bindVariableToEvent(confirmUpgradeVar.varId, confirmUpgradeVar.eventId, confirmUpgradeVar.modelName);
                  setConfirmUpgradeVar(null);
                }}><CheckCircle2 size={14} /> Convert &amp; Bind</button>
              </div>
            </div>
          </div>
        );
      })()}

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
        <div className="ws-modal-overlay sails-qstudio-overlay" onClick={() => setConditionOpen(false)}>
          <div className="ws-modal sails-qstudio-modal" onClick={(e) => e.stopPropagation()}>
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
                extraContextOptions={workflowContextOptions}
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
        // The wizard writes through to the live event config, so this always
        // reflects the current model — even before Done is pressed.
        const modelName = hostEvent?.config.model || '';
        const modelTable = tables.find((t) => t.tableName === modelName);
        const closeRecordFilter = () => setRecordFilterEventId(null);
        return (
          <div className="ws-modal-overlay sails-qstudio-overlay" onClick={closeRecordFilter}>
            <div className="ws-modal sails-qstudio-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal__header">
                <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Filter size={16} /></span>
                <div className="ws-modal__titles">
                  <span className="ws-modal__title">Record Filter</span>
                  <span className="ws-modal__sub">Record Event · {modelTable?.name || modelName || 'No model selected'}</span>
                </div>
                <button className="ws-icon-btn" onClick={closeRecordFilter}><X size={15} /></button>
              </div>
              <div className="ws-modal__body">
                {!modelName ? (
                  <p className="ws-props-hint" style={{ padding: 12 }}>Select a target model first to build a filter.</p>
                ) : !modelTable ? (
                  <p className="ws-props-hint" style={{ padding: 12, color: '#ef4444' }}>
                    Target model &lsquo;{modelName}&rsquo; was not found — re-select it in the event configuration.
                  </p>
                ) : (
                  <FilterBuilder
                    fields={modelTable?.fields || []}
                    rootTableName={modelTable?.tableName || ''}
                    initialGroups={hostEvent?.config.filterGroups || []}
                    showHeader={false}
                    title="Record Filter"
                    extraContextOptions={workflowContextOptions}
                    onApply={(groups) => {
                      if (process.startEvents.some((e) => e.id === recordFilterEventId)) {
                        updateStartEventConfig(recordFilterEventId, { filterGroups: groups });
                      } else {
                        const st = process.stages.find((s) => s.events.some((e) => e.id === recordFilterEventId));
                        if (st) updateEventConfig(st.id, recordFilterEventId, { filterGroups: groups });
                      }
                      closeRecordFilter();
                    }}
                    onCancel={closeRecordFilter}
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
