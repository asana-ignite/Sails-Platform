/**
 * MOCK UP — BPMN-Lite Process Builder (Full DAG)
 *
 * Free-form canvas with start / task / gateway (XOR + AND) / end nodes.
 * Conditional edges, parallel split-join, and revert-to-any-node on reject.
 */
import React, { useMemo, useState, useRef } from 'react';
import {
  Play, CircleDot, ClipboardCheck, Flag, Split, Merge, Plus, Trash2, X,
  Undo2, Filter, Users, User, Briefcase, Shield, Hash, Clock,
  MessageSquare, Webhook, Target, Zap, Settings, AlertTriangle,
  CheckCircle2, MousePointer2, CornerUpLeft, Link2, Workflow, GitBranch, Unlink,
} from 'lucide-react';
import './BpmnBuilder.css';

// ─── Types ────────────────────────────────────────────────────

type NodeType = 'start' | 'task' | 'gateway_xor' | 'gateway_and' | 'end';
type RouterType = 'user' | 'team' | 'position' | 'role' | 'field';
type RejectType = 'end' | 'previous' | 'specific' | 'restart';

interface TaskProps {
  routerType: RouterType;
  routerValue: string;
  routerLabel: string;
  canApprove: boolean;
  canReject: boolean;
  canComment: boolean;
  canReassign: boolean;
  timeoutHours: number | null;
  actionCount: number;
  rejectRoute: { type: RejectType; targetNodeId?: string; maxRejects: number };
}

interface BpmnNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  taskProps?: TaskProps;
}

interface BpmnEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  isDefault?: boolean;
  isRevert?: boolean;
}

interface FlowNode { id: string; type: NodeType; label: string; x: number; y: number; }

// ─── Constants ────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 84;
const WORLD_W = 1500;
const WORLD_H = 820;

const ROUTER_TYPES: { type: RouterType; label: string; icon: React.ReactNode }[] = [
  { type: 'user', label: 'Specific User', icon: <User size={12} /> },
  { type: 'team', label: 'Team', icon: <Users size={12} /> },
  { type: 'position', label: 'Position', icon: <Briefcase size={12} /> },
  { type: 'role', label: 'Role', icon: <Shield size={12} /> },
  { type: 'field', label: 'Record Field', icon: <Hash size={12} /> },
];

const PALETTE: { type: NodeType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'task', label: 'Task', desc: 'Approval / user step', icon: <ClipboardCheck size={14} /> },
  { type: 'gateway_xor', label: 'XOR Gateway', desc: 'One path by condition', icon: <Split size={14} /> },
  { type: 'gateway_and', label: 'AND Gateway', desc: 'All paths in parallel', icon: <Merge size={14} /> },
];

let counter = 0;
function genId(prefix: string): string { counter++; return `${prefix}_${Date.now().toString(36)}_${counter}`; }

function newTaskProps(): TaskProps {
  return {
    routerType: 'team',
    routerValue: '',
    routerLabel: '',
    canApprove: true,
    canReject: true,
    canComment: true,
    canReassign: false,
    timeoutHours: null,
    actionCount: 0,
    rejectRoute: { type: 'end', maxRejects: 0 },
  };
}

function makeNode(type: NodeType, x: number, y: number, label: string): BpmnNode {
  const base: BpmnNode = { id: genId('nd'), type, x, y, label };
  if (type === 'task') base.taskProps = newTaskProps();
  return base;
}

// ─── Sample process (pre-loaded so the mockup looks alive) ─────

const SAMPLE: { nodes: BpmnNode[]; edges: BpmnEdge[] } = (() => {
  const nodes: BpmnNode[] = [
    makeNode('start', 40, 60, 'Start'),
    makeNode('task', 320, 60, 'Contract Submission'),
    makeNode('gateway_xor', 620, 60, 'Amount Check'),
    makeNode('task', 200, 300, 'Senior Approval'),
    makeNode('task', 620, 300, 'Junior Approval'),
    makeNode('gateway_and', 980, 300, 'Parallel Review'),
    makeNode('task', 760, 540, 'Legal Review'),
    makeNode('task', 1200, 540, 'Finance Review'),
    makeNode('gateway_and', 980, 560, 'Review Join'),
    makeNode('task', 420, 700, 'Final Sign-off'),
    makeNode('end', 60, 700, 'End'),
  ];
  // task props for demo
  nodes[1].taskProps = { ...newTaskProps(), routerType: 'team', routerValue: 'legal', routerLabel: 'Legal Team', actionCount: 2 };
  nodes[3].taskProps = { ...newTaskProps(), routerType: 'role', routerValue: 'director', routerLabel: 'Director', actionCount: 1 };
  nodes[4].taskProps = { ...newTaskProps(), routerType: 'role', routerValue: 'manager', routerLabel: 'Manager', actionCount: 0 };
  nodes[6].taskProps = { ...newTaskProps(), routerType: 'team', routerValue: 'legal', routerLabel: 'Legal Counsel', actionCount: 1 };
  nodes[7].taskProps = { ...newTaskProps(), routerType: 'team', routerValue: 'finance', routerLabel: 'Finance', actionCount: 1 };
  nodes[9].taskProps = {
    ...newTaskProps(),
    routerType: 'position',
    routerValue: 'ceo',
    routerLabel: 'CEO',
    actionCount: 2,
    rejectRoute: { type: 'specific', targetNodeId: nodes[3].id, maxRejects: 3 },
  };

  const edges: BpmnEdge[] = [
    { id: genId('eg'), from: nodes[0].id, to: nodes[1].id },
    { id: genId('eg'), from: nodes[1].id, to: nodes[2].id },
    { id: genId('eg'), from: nodes[2].id, to: nodes[3].id, label: 'amount > 50000' },
    { id: genId('eg'), from: nodes[2].id, to: nodes[4].id, isDefault: true },
    { id: genId('eg'), from: nodes[3].id, to: nodes[5].id },
    { id: genId('eg'), from: nodes[4].id, to: nodes[8].id },
    { id: genId('eg'), from: nodes[5].id, to: nodes[6].id },
    { id: genId('eg'), from: nodes[5].id, to: nodes[7].id },
    { id: genId('eg'), from: nodes[6].id, to: nodes[8].id },
    { id: genId('eg'), from: nodes[7].id, to: nodes[8].id },
    { id: genId('eg'), from: nodes[8].id, to: nodes[9].id },
    { id: genId('eg'), from: nodes[9].id, to: nodes[10].id },
    { id: genId('eg'), from: nodes[9].id, to: nodes[3].id, label: 'on reject', isRevert: true },
  ];
  return { nodes, edges };
})();

// ─── Geometry helpers ─────────────────────────────────────────

interface Pt { x: number; y: number; }

function outPort(n: FlowNode): Pt { return { x: n.x + NODE_W / 2, y: n.y + NODE_H }; }
function inPort(n: FlowNode): Pt { return { x: n.x + NODE_W / 2, y: n.y }; }

function edgePath(a: FlowNode, b: FlowNode): string {
  const o = outPort(a);
  const i = inPort(b);
  if (b.y > a.y + 40) {
    const dy = Math.max(60, (i.y - o.y) * 0.55);
    return `M ${o.x} ${o.y} C ${o.x} ${o.y + dy}, ${i.x} ${i.y - dy}, ${i.x} ${i.y}`;
  }
  const ro = { x: a.x + NODE_W, y: a.y + NODE_H / 2 };
  const li = { x: b.x, y: b.y + NODE_H / 2 };
  const dx = Math.max(60, (ro.x - li.x) * 0.55);
  return `M ${ro.x} ${ro.y} C ${ro.x + dx} ${ro.y}, ${li.x - dx} ${li.y}, ${li.x} ${li.y}`;
}

function edgeMidpoint(a: FlowNode, b: FlowNode): Pt {
  const o = outPort(a);
  const i = inPort(b);
  if (b.y > a.y + 40) {
    const dy = Math.max(60, (i.y - o.y) * 0.55);
    const t = 0.5;
    const mx = (1 - t) ** 3 * o.x + 3 * (1 - t) ** 2 * t * o.x + 3 * (1 - t) * t ** 2 * i.x + t ** 3 * i.x;
    const my = (1 - t) ** 3 * o.y + 3 * (1 - t) ** 2 * t * (o.y + dy) + 3 * (1 - t) * t ** 2 * (i.y - dy) + t ** 3 * i.y;
    return { x: mx, y: my };
  }
  const ro = { x: a.x + NODE_W, y: a.y + NODE_H / 2 };
  const li = { x: b.x, y: b.y + NODE_H / 2 };
  const dx = Math.max(60, (ro.x - li.x) * 0.55);
  const t = 0.5;
  const mx = (1 - t) ** 3 * ro.x + 3 * (1 - t) ** 2 * t * (ro.x + dx) + 3 * (1 - t) * t ** 2 * (li.x - dx) + t ** 3 * li.x;
  const my = (1 - t) ** 3 * ro.y + 3 * (1 - t) ** 2 * t * ro.y + 3 * (1 - t) * t ** 2 * li.y + t ** 3 * li.y;
  return { x: mx, y: my };
}

// ─── Main Component ───────────────────────────────────────────

export const BpmnBuilder: React.FC = () => {
  const [processName, setProcessName] = useState('Contract Approval — BPMN-Lite');
  const [nodes, setNodes] = useState<BpmnNode[]>(SAMPLE.nodes);
  const [edges, setEdges] = useState<BpmnEdge[]>(SAMPLE.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'node' | 'edge' | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectPos, setConnectPos] = useState<Pt | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pathCount, setPathCount] = useState(0);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const nodeById = useMemo(() => {
    const m = new Map<string, BpmnNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const outgoing = useMemo(() => {
    const m = new Map<string, BpmnEdge[]>();
    edges.forEach((e) => {
      if (!m.has(e.from)) m.set(e.from, []);
      m.get(e.from)!.push(e);
    });
    return m;
  }, [edges]);

  const incoming = useMemo(() => {
    const m = new Map<string, BpmnEdge[]>();
    edges.forEach((e) => {
      if (!m.has(e.to)) m.set(e.to, []);
      m.get(e.to)!.push(e);
    });
    return m;
  }, [edges]);

  const selectedNode = selectedKind === 'node' && selectedId ? nodeById.get(selectedId) || null : null;
  const selectedEdge = selectedKind === 'edge' && selectedId ? edges.find((e) => e.id === selectedId) || null : null;

  // ── Validation + path count (recomputed on every change) ──
  useMemo(() => {
    const startNode = nodes.find((n) => n.type === 'start');
    const endNode = nodes.find((n) => n.type === 'end');
    const w: string[] = [];
    if (!startNode) w.push('No Start node on the canvas.');
    if (!endNode) w.push('No End node on the canvas.');

    // reachability from start
    const reach = new Set<string>();
    const stack: string[] = startNode ? [startNode.id] : [];
    while (stack.length) {
      const id = stack.pop()!;
      if (reach.has(id)) continue;
      reach.add(id);
      (outgoing.get(id) || []).forEach((e) => stack.push(e.to));
    }
    nodes.forEach((n) => {
      if (n.type !== 'start' && !reach.has(n.id)) w.push(`"${n.label}" is not reachable from Start.`);
    });

    // node without incoming (except start)
    nodes.forEach((n) => {
      if (n.type !== 'start' && !(incoming.get(n.id) || []).length) {
        w.push(`"${n.label}" has no incoming connection.`);
      }
    });

    // gateways
    nodes.forEach((n) => {
      const outs = outgoing.get(n.id) || [];
      if (n.type === 'gateway_xor' && outs.length < 2) {
        w.push(`XOR "${n.label}" needs at least 2 outgoing paths.`);
      }
      if (n.type === 'gateway_xor') {
        outs.forEach((e) => {
          if (!e.label && !e.isDefault) w.push(`XOR path from "${n.label}" has no condition and is not default.`);
        });
      }
      if (n.type === 'gateway_and' && outs.length < 2) {
        w.push(`AND "${n.label}" needs at least 2 parallel paths.`);
      }
    });

    // count simple paths start → end (cap)
    let paths = 0;
    if (startNode && endNode) {
      const dfs = (id: string, visited: Set<string>) => {
        if (paths >= 20) return;
        if (id === endNode.id) { paths++; return; }
        (outgoing.get(id) || []).forEach((e) => {
          if (!visited.has(e.to)) { const v = new Set(visited); v.add(e.to); dfs(e.to, v); }
        });
      };
      dfs(startNode.id, new Set([startNode.id]));
    }
    setPathCount(paths);
    setWarnings(w);
  }, [nodes, edges, outgoing, incoming]);

  // ── Node ops ──
  const addNodeFromPalette = (type: NodeType, x: number, y: number) => {
    if (type === 'start' && nodes.some((n) => n.type === 'start')) return;
    if (type === 'end' && nodes.some((n) => n.type === 'end')) return;
    const labels: Record<NodeType, string> = {
      start: 'Start', end: 'End',
      task: 'New Task',
      gateway_xor: 'XOR Gateway',
      gateway_and: 'AND Gateway',
    };
    setNodes((prev) => [...prev, makeNode(type, x, y, labels[type])]);
  };

  const updateNode = (id: string, patch: Partial<BpmnNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const updateTaskProps = (id: string, patch: Partial<TaskProps>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, taskProps: { ...n.taskProps!, ...patch } } : n)));
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedId === id) { setSelectedId(null); setSelectedKind(null); }
    if (connectFrom === id) setConnectFrom(null);
  };

  // ── Edge ops ──
  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    if (edges.some((e) => e.from === from && e.to === to)) return;
    const fromNode = nodeById.get(from);
    const toNode = nodeById.get(to);
    if (!fromNode || !toNode) return;
    setEdges((prev) => [...prev, { id: genId('eg'), from, to }]);
  };

  const updateEdge = (id: string, patch: Partial<BpmnEdge>) => {
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) { setSelectedId(null); setSelectedKind(null); }
  };

  // ── Canvas interaction ──
  const handlePaletteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/json') as NodeType;
    if (!type) return;
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(WORLD_W - NODE_W, e.clientX - rect.left - NODE_W / 2));
    const y = Math.max(0, Math.min(WORLD_H - NODE_H, e.clientY - rect.top - NODE_H / 2));
    addNodeFromPalette(type, x, y);
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (connectFrom) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({ id, dx: e.clientX - rect.left, dy: e.clientY - rect.top });
    setSelectedId(id);
    setSelectedKind('node');
  };

  const handleWorldPointerMove = (e: React.PointerEvent) => {
    if (connectFrom) {
      const rect = worldRef.current?.getBoundingClientRect();
      if (rect) setConnectPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
    if (!dragging) return;
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(0, Math.min(WORLD_W - NODE_W, e.clientX - rect.left - dragging.dx));
    const ny = Math.max(0, Math.min(WORLD_H - NODE_H, e.clientY - rect.top - dragging.dy));
    updateNode(dragging.id, { x: nx, y: ny });
  };

  const handleWorldPointerUp = () => {
    setDragging(null);
  };

  const handleNodePointerUp = (e: React.PointerEvent, id: string) => {
    if (connectFrom) {
      e.stopPropagation();
      addEdge(connectFrom, id);
      setConnectFrom(null);
      setConnectPos(null);
      return;
    }
  };

  const startConnect = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConnectFrom(id);
    setSelectedId(null);
    setSelectedKind(null);
  };

  // Keyboard: Delete removes selection, Escape cancels connect
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { setConnectFrom(null); setConnectPos(null); return; }
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) {
        const t = ev.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
        ev.preventDefault();
        if (selectedKind === 'node') removeNode(selectedId);
        else removeEdge(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedKind, edges, nodes]);

  const flowNodes = nodes as FlowNode[];

  // ── Right panel content ──
  const renderNodeProps = (n: BpmnNode) => {
    const isTask = n.type === 'task';
    const tp = n.taskProps;
    const allTargets = nodes.filter((x) => x.id !== n.id && x.type !== 'end');
    const prevTarget = (incoming.get(n.id) || [])[0]?.from || nodes.find((x) => x.type === 'start')?.id || '';

    return (
      <div className="bpmb-props">
        <div className="bpmb-prop-group">
          <label className="bpmb-prop-label">Node Label</label>
          <input className="sails-input" value={n.label} onChange={(e) => updateNode(n.id, { label: e.target.value })} />
        </div>

        <div className="bpmb-prop-group">
          <span className="bpmb-prop-badge">{n.type.toUpperCase()}</span>
        </div>

        {isTask && tp && (
          <>
            <div className="bpmb-section-title">Router</div>
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">Router Type</label>
              <select className="sails-input" value={tp.routerType}
                onChange={(e) => updateTaskProps(n.id, { routerType: e.target.value as RouterType })}>
                {ROUTER_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
              </select>
            </div>
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">{tp.routerType === 'field' ? 'Field Name' : 'Router Value'}</label>
              <input className="sails-input" value={tp.routerValue}
                onChange={(e) => updateTaskProps(n.id, { routerValue: e.target.value })} />
            </div>
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">Display Label</label>
              <input className="sails-input" value={tp.routerLabel}
                onChange={(e) => updateTaskProps(n.id, { routerLabel: e.target.value })} />
            </div>

            <div className="bpmb-section-title">Capabilities</div>
            <div className="bpmb-prop-group bpmb-check-grid">
              <label className="bpmb-check"><input type="checkbox" checked={tp.canApprove} onChange={(e) => updateTaskProps(n.id, { canApprove: e.target.checked })} /> Approve</label>
              <label className="bpmb-check"><input type="checkbox" checked={tp.canReject} onChange={(e) => updateTaskProps(n.id, { canReject: e.target.checked })} /> Reject</label>
              <label className="bpmb-check"><input type="checkbox" checked={tp.canComment} onChange={(e) => updateTaskProps(n.id, { canComment: e.target.checked })} /> Comment</label>
              <label className="bpmb-check"><input type="checkbox" checked={tp.canReassign} onChange={(e) => updateTaskProps(n.id, { canReassign: e.target.checked })} /> Reassign</label>
            </div>

            <div className="bpmb-section-title">Timeout & Actions</div>
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">Timeout (hours)</label>
              <input className="sails-input" type="number" min={0} value={tp.timeoutHours ?? ''}
                placeholder="No timeout"
                onChange={(e) => updateTaskProps(n.id, { timeoutHours: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="bpmb-prop-group">
              <span className="bpmb-prop-label">Side effects (mock): {tp.actionCount} actions
                <button className="bpmb-mini-btn" onClick={() => updateTaskProps(n.id, { actionCount: tp.actionCount + 1 })}><Plus size={11} /></button>
              </span>
            </div>

            <div className="bpmb-section-title bpmb-section-title--revert">
              <CornerUpLeft size={12} /> On Reject (revert)
            </div>
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">Route back to</label>
              <select className="sails-input" value={tp.rejectRoute.type}
                onChange={(e) => updateTaskProps(n.id, { rejectRoute: { ...tp.rejectRoute, type: e.target.value as RejectType } })}>
                <option value="end">End process</option>
                <option value="previous">Previous step</option>
                <option value="specific">Specific node…</option>
                <option value="restart">Start over</option>
              </select>
            </div>
            {tp.rejectRoute.type === 'specific' && (
              <div className="bpmb-prop-group">
                <label className="bpmb-prop-label">Target node</label>
                <select className="sails-input" value={tp.rejectRoute.targetNodeId || ''}
                  onChange={(e) => updateTaskProps(n.id, { rejectRoute: { ...tp.rejectRoute, targetNodeId: e.target.value || undefined } })}>
                  <option value="">Select…</option>
                  {allTargets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            )}
            {tp.rejectRoute.type === 'previous' && prevTarget && (
              <span className="bpmb-hint">Will return to: "{nodeById.get(prevTarget)?.label || 'Start'}"</span>
            )}
            <div className="bpmb-prop-group">
              <label className="bpmb-prop-label">Max rejects (0 = unlimited)</label>
              <input className="sails-input" type="number" min={0} value={tp.rejectRoute.maxRejects}
                onChange={(e) => updateTaskProps(n.id, { rejectRoute: { ...tp.rejectRoute, maxRejects: e.target.value ? Number(e.target.value) : 0 } })} />
            </div>
          </>
        )}

        {n.type === 'gateway_xor' && (
          <div className="bpmb-hint">
            One outgoing path is taken. Give each outgoing edge a condition (or mark it default) from the edge list.
          </div>
        )}
        {n.type === 'gateway_and' && (
          <div className="bpmb-hint">
            All outgoing paths run in parallel. Joining AND gateways wait for all incoming branches (configurable join policy).
          </div>
        )}

        <button className="sails-btn sails-btn--danger sails-btn--sm bpmb-delete-btn" onClick={() => removeNode(n.id)}>
          <Trash2 size={12} /> Delete Node
        </button>
      </div>
    );
  };

  const renderEdgeProps = (e: BpmnEdge) => {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    return (
      <div className="bpmb-props">
        <div className="bpmb-prop-group">
          <span className="bpmb-prop-label">Connection</span>
          <span className="bpmb-edge-summary">
            {from?.label || '?'} <Link2 size={12} /> {to?.label || '?'}
          </span>
        </div>

        <div className="bpmb-section-title">Path Configuration</div>
        <div className="bpmb-prop-group">
          <label className="bpmb-prop-label">Condition (expression)</label>
          <input className="sails-input bpmb-code" value={e.label || ''}
            placeholder="e.g. amount > 50000"
            onChange={(ev) => updateEdge(e.id, { label: ev.target.value || undefined })} />
          <span className="bpmb-hint">Empty = unconditional. XOR paths need a condition or default.</span>
        </div>
        <div className="bpmb-prop-group">
          <label className="bpmb-check">
            <input type="checkbox" checked={!!e.isDefault} onChange={(ev) => updateEdge(e.id, { isDefault: ev.target.checked })} />
            Default path (no condition matches)
          </label>
        </div>
        <div className="bpmb-prop-group">
          <label className="bpmb-check">
            <input type="checkbox" checked={!!e.isRevert} onChange={(ev) => updateEdge(e.id, { isRevert: ev.target.checked, ...(ev.target.checked ? { label: e.label || 'on reject' } : {}) })} />
            Revert edge (drawn dashed)
          </label>
          <span className="bpmb-hint">Revert edges model rollback — a reject routes the record backwards.</span>
        </div>

        <button className="sails-btn sails-btn--danger sails-btn--sm bpmb-delete-btn" onClick={() => removeEdge(e.id)}>
          <Unlink size={12} /> Delete Connection
        </button>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="bpmb-root">
      {/* Toolbar */}
      <div className="bpmb-toolbar">
        <span className="bpmb-toolbar__brand"><Workflow size={15} /> BPMN-Lite Process Builder</span>
        <input
          className="bpmb-toolbar__name"
          value={processName}
          onChange={(e) => setProcessName(e.target.value)}
          placeholder="Process name"
        />
        <div className="bpmb-toolbar__actions">
          <span className={`bpmb-validity ${warnings.length === 0 ? 'bpmb-validity--ok' : 'bpmb-validity--warn'}`}>
            {warnings.length === 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {warnings.length === 0 ? 'Valid' : `${warnings.length} issue${warnings.length > 1 ? 's' : ''}`}
          </span>
          <button className="sails-btn sails-btn--ghost sails-btn--sm">Cancel</button>
          <button className="sails-btn sails-btn--primary sails-btn--sm">Save Process</button>
        </div>
      </div>

      <div className="bpmb-body">
        {/* LEFT: Palette */}
        <div className="bpmb-palette">
          <h3 className="bpmb-panel-title"><Settings size={13} /> Elements</h3>
          <div className="bpmb-palette__list">
            <div
              className="bpmb-palette-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', 'start')}
              onDoubleClick={() => addNodeFromPalette('start', 60, 60)}
            >
              <span className="bpmb-palette-icon bpmb-palette-icon--start"><Play size={14} /></span>
              <span className="bpmb-palette-info"><span className="bpmb-palette-name">Start</span><span className="bpmb-palette-desc">Process entry</span></span>
              {nodes.some((n) => n.type === 'start') && <span className="bpmb-palette-used">×</span>}
            </div>
            {PALETTE.map((p) => (
              <div
                key={p.type}
                className="bpmb-palette-item"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/json', p.type)}
                onDoubleClick={() => addNodeFromPalette(p.type, 300 + Math.random() * 200, 100 + Math.random() * 200)}
              >
                <span className={`bpmb-palette-icon bpmb-palette-icon--${p.type}`}>{p.icon}</span>
                <span className="bpmb-palette-info"><span className="bpmb-palette-name">{p.label}</span><span className="bpmb-palette-desc">{p.desc}</span></span>
              </div>
            ))}
            <div
              className="bpmb-palette-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', 'end')}
              onDoubleClick={() => addNodeFromPalette('end', 60, 600)}
            >
              <span className="bpmb-palette-icon bpmb-palette-icon--end"><Flag size={14} /></span>
              <span className="bpmb-palette-info"><span className="bpmb-palette-name">End</span><span className="bpmb-palette-desc">Process exit</span></span>
              {nodes.some((n) => n.type === 'end') && <span className="bpmb-palette-used">×</span>}
            </div>
          </div>
          <div className="bpmb-palette-help">
            <p><MousePointer2 size={12} /> Drag elements onto the canvas. Drag a node to move it.</p>
            <p><GitBranch size={12} /> Drag from a node's <strong>bottom dot</strong> to another node to connect them.</p>
            <p><CornerUpLeft size={12} /> Set "On Reject" on any task to create rollback.</p>
          </div>
        </div>

        {/* CENTER: Canvas */}
        <div className="bpmb-canvas">
          <div
            className="bpmb-canvas__world"
            ref={worldRef}
            style={{ width: WORLD_W, height: WORLD_H }}
            onPointerMove={handleWorldPointerMove}
            onPointerUp={handleWorldPointerUp}
            onDrop={handlePaletteDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => { if (!connectFrom) { setSelectedId(null); setSelectedKind(null); } }}
          >
            <svg className="bpmb-edges" width={WORLD_W} height={WORLD_H}>
              <defs>
                <marker id="bpmb-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--sails-border,#94a3b8)" />
                </marker>
                <marker id="bpmb-arrow-revert" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0,0 L9,4.5 L0,9 Z" fill="#6366f1" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = nodeById.get(e.from);
                const b = nodeById.get(e.to);
                if (!a || !b) return null;
                const mid = edgeMidpoint(a, b);
                const isSel = selectedKind === 'edge' && selectedId === e.id;
                return (
                  <g key={e.id} className={`bpmb-edge ${isSel ? 'bpmb-edge--selected' : ''}`}>
                    <path
                      d={edgePath(a, b)}
                      fill="none"
                      stroke={e.isRevert ? '#6366f1' : 'var(--sails-border,#94a3b8)'}
                      strokeWidth={isSel ? 2.5 : 1.6}
                      strokeDasharray={e.isRevert ? '7 5' : undefined}
                      markerEnd={e.isRevert ? 'url(#bpmb-arrow-revert)' : 'url(#bpmb-arrow)'}
                      onClick={(ev) => { ev.stopPropagation(); setSelectedId(e.id); setSelectedKind('edge'); }}
                      style={{ cursor: 'pointer' }}
                    />
                    <rect
                      x={mid.x - 55} y={mid.y - 12} width={110} height={24} rx={12}
                      fill={isSel ? 'rgba(157,206,224,0.35)' : 'rgba(255,255,255,0.92)'}
                      stroke={e.isRevert ? '#6366f1' : 'var(--sails-border,#cbd5e1)'}
                      strokeWidth={1}
                      onClick={(ev) => { ev.stopPropagation(); setSelectedId(e.id); setSelectedKind('edge'); }}
                      style={{ cursor: 'pointer' }}
                    />
                    <text
                      x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={10}
                      fill={e.isRevert ? '#6366f1' : 'var(--sails-text-secondary,#64748b)'}
                      fontWeight={e.isRevert || e.isDefault ? 600 : 400}
                      pointerEvents="none"
                    >
                      {e.isRevert ? '↩ reject' : (e.label || (e.isDefault ? 'default' : ''))}
                    </text>
                  </g>
                );
              })}
              {connectFrom && connectPos && nodeById.get(connectFrom) && (
                <g className="bpmb-edge bpmb-edge--temp">
                  <line
                    x1={outPort(nodeById.get(connectFrom)!).x}
                    y1={outPort(nodeById.get(connectFrom)!).y}
                    x2={connectPos.x}
                    y2={connectPos.y}
                    stroke="var(--sails-primary,#9dcee0)"
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                    markerEnd="url(#bpmb-arrow)"
                  />
                </g>
              )}
            </svg>

            {nodes.map((n) => {
              const isSel = selectedKind === 'node' && selectedId === n.id;
              const outs = outgoing.get(n.id) || [];
              const isStart = n.type === 'start';
              const isEnd = n.type === 'end';
              const tp = n.taskProps;
              const revertLabel =
                tp && tp.rejectRoute.type !== 'end'
                  ? tp.rejectRoute.type === 'previous' ? '↩ prev' : tp.rejectRoute.type === 'restart' ? '↩ start' : '↩ node'
                  : null;
              return (
                <div
                  key={n.id}
                  className={`bpmb-node bpmb-node--${n.type} ${isSel ? 'bpmb-node--selected' : ''} ${connectFrom ? 'bpmb-node--connectable' : ''}`}
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                  onPointerDown={(e) => handleNodePointerDown(e, n.id)}
                  onPointerUp={(e) => handleNodePointerUp(e, n.id)}
                  onClick={(e) => { e.stopPropagation(); if (!connectFrom) { setSelectedId(n.id); setSelectedKind('node'); } }}
                >
                  <div className="bpmb-node__icon">
                    {n.type === 'start' && <Play size={14} />}
                    {n.type === 'end' && <Flag size={14} />}
                    {n.type === 'task' && <ClipboardCheck size={14} />}
                    {n.type === 'gateway_xor' && <Split size={14} />}
                    {n.type === 'gateway_and' && <Merge size={14} />}
                  </div>
                  <div className="bpmb-node__body">
                    <span className="bpmb-node__label">{n.label}</span>
                    <span className="bpmb-node__meta">
                      {n.type === 'task' && tp && (
                        <>
                          {tp.routerLabel || tp.routerType}
                          {tp.timeoutHours ? ` · ${tp.timeoutHours}h` : ''}
                          {revertLabel && <em className="bpmb-node__revert">{revertLabel}</em>}
                        </>
                      )}
                      {n.type === 'gateway_xor' && `paths: ${outs.length}`}
                      {n.type === 'gateway_and' && `parallel: ${outs.length}`}
                    </span>
                  </div>
                  {!isEnd && (
                    <span
                      className="bpmb-port bpmb-port--out"
                      title="Drag to connect"
                      onPointerDown={(e) => startConnect(e, n.id)}
                    >
                      <CircleDot size={11} />
                    </span>
                  )}
                  {!isStart && <span className="bpmb-port bpmb-port--in" />}
                </div>
              );
            })}

            {connectFrom && nodeById.get(connectFrom) && (
              <div className="bpmb-connect-hint">Drop on a node to connect · Esc to cancel</div>
            )}
          </div>
        </div>

        {/* RIGHT: Properties / Stats */}
        <div className="bpmb-side">
          <h3 className="bpmb-panel-title"><Settings size={13} /> Properties</h3>

          {selectedNode && renderNodeProps(selectedNode)}
          {selectedEdge && renderEdgeProps(selectedEdge)}
          {!selectedNode && !selectedEdge && (
            <div className="bpmb-props">
              <div className="bpmb-empty-state">
                <MousePointer2 size={20} />
                <p>Select a node or connection to edit its properties.</p>
              </div>
            </div>
          )}

          <div className="bpmb-side__stats">
            <h3 className="bpmb-panel-title"><Settings size={13} /> Process Stats</h3>
            <div className="bpmb-stat">
              <span className="bpmb-stat__key">Nodes</span>
              <span className="bpmb-stat__value">{nodes.length}</span>
            </div>
            <div className="bpmb-stat">
              <span className="bpmb-stat__key">Connections</span>
              <span className="bpmb-stat__value">{edges.length}</span>
            </div>
            <div className="bpmb-stat">
              <span className="bpmb-stat__key">Gateways</span>
              <span className="bpmb-stat__value">{nodes.filter((n) => n.type.startsWith('gateway')).length}</span>
            </div>
            <div className="bpmb-stat">
              <span className="bpmb-stat__key">Distinct Paths</span>
              <span className="bpmb-stat__value">{pathCount}</span>
            </div>
            <div className="bpmb-stat">
              <span className="bpmb-stat__key">Revert Points</span>
              <span className="bpmb-stat__value">
                {nodes.filter((n) => n.taskProps && n.taskProps.rejectRoute.type !== 'end').length}
              </span>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="bpmb-warnings">
              <h3 className="bpmb-panel-title" style={{ color: 'var(--sails-danger, #ef4444)' }}>
                <AlertTriangle size={12} /> Validation
              </h3>
              {warnings.map((w, i) => <p key={i} className="bpmb-warning">{w}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BpmnBuilder;
