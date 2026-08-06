/**
 * MOCK UP — Routing Process Builder v2
 *
 * Orchestrator: owns all state + interaction handlers and composes the
 * workflow module's components (palette, canvas, properties panel, expression
 * modal). Stage/event/branch logic lives in ./workflow — see:
 *   - workflow/types.ts, constants.ts, helpers.ts, geometry.ts
 *   - workflow/components/* (EventPalette, WorkflowCanvas, StageCard,
 *     EventConfigForm, PropertiesPanel, ExpressionModal)
 */
import React, { useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Layers, Workflow } from 'lucide-react';
import {
  ALL_PORTS, CANVAS_W, CHAIN_SPACING, CHAIN_X, EVENT_DEFS, NODE_H, NODE_W,
} from './workflow/constants';
import { defaultPorts, endPortPos, portPos } from './workflow/geometry';
import {
  analyzeExpressions, buildSample, newBranch, newEvent, newStage, newVariable,
} from './workflow/helpers';
import type {
  BranchCondition, LayoutMode, Port, Pt, RouteStage, RoutingProcess, WorkflowEdge, WorkflowEvent,
  WorkflowVariable,
} from './workflow/types';
import { EventPalette } from './workflow/components/EventPalette';
import { WorkflowCanvas } from './workflow/components/WorkflowCanvas';
import { PropertiesPanel } from './workflow/components/PropertiesPanel';
import { ExpressionModal } from './workflow/components/ExpressionModal';
import './RouteBuilder.css';

export const RouteBuilder: React.FC = () => {
  const [process, setProcess] = useState<RoutingProcess>(buildSample);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('chain');
  const [activeTab, setActiveTab] = useState<'workflow' | 'stage'>('workflow');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingLabelStageId, setEditingLabelStageId] = useState<string | null>(null);
  const [endPos, setEndPos] = useState<Pt>({ x: 320, y: 740 });
  const [dragging, setDragging] = useState<{ id: string; kind: 'stage' | 'end'; dx: number; dy: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [draggingEdgePort, setDraggingEdgePort] = useState<{ branchId: string; side: 'from' | 'to' } | null>(null);
  const [connectFrom, setConnectFrom] = useState<{ stageId: string; port: Port } | null>(null);
  const [connectPos, setConnectPos] = useState<Pt | null>(null);
  const [exprModalEventId, setExprModalEventId] = useState<string | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const selectedStage = process.stages.find((s) => s.id === selectedStageId) || null;
  const selectedEvent = selectedStage ? selectedStage.events.find((e) => e.id === selectedEventId) || null : null;
  const exprModalEvent = selectedStage && exprModalEventId
    ? selectedStage.events.find((e) => e.id === exprModalEventId) || null
    : null;

  const stagePos = (idx: number, s: RouteStage): Pt =>
    layoutMode === 'chain' ? { x: CHAIN_X, y: 40 + idx * CHAIN_SPACING } : { x: s.x, y: s.y };

  const endNodePos: Pt = layoutMode === 'chain'
    ? { x: CHAIN_X, y: 40 + process.stages.length * CHAIN_SPACING + 20 }
    : endPos;

  const worldHeight = layoutMode === 'chain'
    ? 40 + process.stages.length * CHAIN_SPACING + 200
    : Math.max(820, ...process.stages.map((s) => s.y + NODE_H + 160));

  // ── Edges: branches + implicit next line ──
  const edges = useMemo<WorkflowEdge[]>(() => {
    const out: WorkflowEdge[] = [];
    process.stages.forEach((s, idx) => {
      const a = stagePos(idx, s);
      const explicit = s.branches.length > 0;
      if (explicit) {
        s.branches.forEach((br) => {
          if (br.targetType === 'completed') {
            const dp = defaultPorts(a, endNodePos);
            out.push({
              id: br.id, a, b: endNodePos, label: br.label, kind: 'branch',
              fromPort: br.fromPort || dp.fromPort, toPort: br.toPort || dp.toPort,
              branchId: br.id, sourceStageId: s.id, isEndTarget: true,
            });
          } else {
            const tIdx = process.stages.findIndex((st) => st.id === br.targetStageId);
            if (tIdx === -1) return;
            const tb = stagePos(tIdx, process.stages[tIdx]);
            const dp = defaultPorts(a, tb);
            out.push({
              id: br.id, a, b: tb, label: br.label, kind: 'branch',
              fromPort: br.fromPort || dp.fromPort, toPort: br.toPort || dp.toPort,
              branchId: br.id, sourceStageId: s.id, isEndTarget: false,
            });
          }
        });
      } else if (idx < process.stages.length - 1) {
        const nxt = stagePos(idx + 1, process.stages[idx + 1]);
        const dp = defaultPorts(a, nxt);
        out.push({ id: `imp_${s.id}`, a, b: nxt, label: '', kind: 'implicit', fromPort: dp.fromPort, toPort: dp.toPort, isEndTarget: false });
      } else {
        const dp = defaultPorts(a, endNodePos);
        out.push({ id: `imp_${s.id}`, a, b: endNodePos, label: '', kind: 'implicit', fromPort: dp.fromPort, toPort: dp.toPort, isEndTarget: true });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process, layoutMode, endNodePos]);

  // ── Stage ops ──
  const updateStage = (stageId: string, patch: Partial<RouteStage>) => {
    setProcess((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) }));
  };

  const moveStage = (stageId: string, direction: 'up' | 'down') => {
    setProcess((p) => {
      const stages = [...p.stages];
      const idx = stages.findIndex((s) => s.id === stageId);
      const other = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || other < 0 || other >= stages.length) return p;
      [stages[idx], stages[other]] = [stages[other], stages[idx]];
      return { ...p, stages };
    });
  };

  const removeStage = (stageId: string) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.filter((s) => s.id !== stageId).map((s) => ({
        ...s,
        branches: s.branches.filter((br) => br.targetStageId !== stageId),
      })),
    }));
    if (selectedStageId === stageId) { setSelectedStageId(null); setSelectedEventId(null); }
  };

  const addStageAt = (x: number, y: number) => {
    const st = newStage(`Stage ${process.stages.length + 1}`, x, y);
    setProcess((p) => ({ ...p, stages: [...p.stages, st] }));
    setSelectedStageId(st.id);
    setActiveTab('stage');
  };

  // ── Events ──
  const addEventToStage = (stageId: string, type: WorkflowEvent['type']) => {
    const ev = newEvent(type);
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: [...s.events, ev] } : s)),
    }));
    setSelectedStageId(stageId);
    setSelectedEventId(ev.id);
    setActiveTab('stage');
  };

  const updateEventConfig = (stageId: string, eventId: string, patch: Record<string, any>) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId
        ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, config: { ...e.config, ...patch } } : e)) }
        : s)),
    }));
  };

  const updateEventLabel = (stageId: string, eventId: string, label: string) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId
        ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, label } : e)) }
        : s)),
    }));
  };

  const moveEvent = (stageId: string, eventId: string, direction: 'up' | 'down') => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => {
        if (s.id !== stageId) return s;
        const events = [...s.events];
        const idx = events.findIndex((e) => e.id === eventId);
        const other = direction === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || other < 0 || other >= events.length) return s;
        [events[idx], events[other]] = [events[other], events[idx]];
        return { ...s, events };
      }),
    }));
  };

  const removeEvent = (stageId: string, eventId: string) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, events: s.events.filter((e) => e.id !== eventId) } : s)),
    }));
    if (selectedEventId === eventId) setSelectedEventId(null);
  };

  // ── Branches ──
  const addBranch = (stageId: string) => {
    const br = newBranch();
    br.targetType = 'completed';
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, branches: [...s.branches, br] } : s)),
    }));
  };

  const addBranchWithPorts = (fromStageId: string, fromPort: Port, toStageId: string, toPort: Port) => {
    const br = newBranch();
    br.label = 'New branch';
    br.targetType = 'stage';
    br.targetStageId = toStageId;
    br.fromPort = fromPort;
    br.toPort = toPort;
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === fromStageId ? { ...s, branches: [...s.branches, br] } : s)),
    }));
    setSelectedStageId(fromStageId);
    setActiveTab('stage');
  };

  const updateBranch = (stageId: string, branchId: string, patch: Partial<BranchCondition>) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId
        ? { ...s, branches: s.branches.map((br) => (br.id === branchId ? { ...br, ...patch } : br)) }
        : s)),
    }));
  };

  const removeBranch = (stageId: string, branchId: string) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, branches: s.branches.filter((br) => br.id !== branchId) } : s)),
    }));
  };

  // ── Variables ──
  const addVariable = () => {
    const v = newVariable();
    setProcess((p) => ({ ...p, variables: [...p.variables, v] }));
  };

  const updateVariable = (varId: string, patch: Partial<WorkflowVariable>) => {
    setProcess((p) => ({
      ...p,
      variables: p.variables.map((v) => (v.id === varId ? { ...v, ...patch } : v)),
    }));
  };

  const removeVariable = (varId: string) => {
    setProcess((p) => ({ ...p, variables: p.variables.filter((v) => v.id !== varId) }));
  };

  // ── Keyboard: Delete / Backspace removes the selected element ──
  const deleteSelection = () => {
    if (selectedEdgeId) {
      const owner = process.stages.find((st) => st.branches.some((b) => b.id === selectedEdgeId));
      if (owner) {
        removeBranch(owner.id, selectedEdgeId);
        setSelectedEdgeId(null);
      }
      return;
    }
    if (selectedEventId && selectedStageId) {
      removeEvent(selectedStageId, selectedEventId);
      return;
    }
    if (selectedStageId) {
      removeStage(selectedStageId);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (editingLabelStageId) return;
      e.preventDefault();
      deleteSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStageId, selectedEventId, selectedEdgeId, editingLabelStageId, process]);

  /** Commit an inline-renamed stage label (Enter / blur). */
  const commitStageLabel = (stageId: string, value: string) => {
    setEditingLabelStageId(null);
    const name = value.trim();
    if (name) updateStage(stageId, { name });
  };

  // ── Canvas pointer interaction ──
  const getWorldPos = (e: React.PointerEvent | React.MouseEvent): Pt => {
    const rect = worldRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const nearestPort = (nodePos: Pt, pos: Pt, isEnd = false): Port => {
    let best: Port = 'top';
    let bestD = Infinity;
    ALL_PORTS.forEach((p) => {
      const pp = isEnd ? endPortPos(nodePos, p) : portPos(nodePos, p);
      const d = (pp.x - pos.x) ** 2 + (pp.y - pos.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  };

  const handleNodePointerDown = (e: React.PointerEvent, stageId: string) => {
    if (connectFrom) return; // already connecting from a port
    if (layoutMode !== 'canvas' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({ id: stageId, kind: 'stage', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  };

  const handleEndPointerDown = (e: React.PointerEvent) => {
    if (connectFrom) return;
    if (layoutMode !== 'canvas' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragging({ id: '__end__', kind: 'end', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  };

  /** Start a new connection by dragging from a stage port. */
  const handlePortPointerDown = (e: React.PointerEvent, stageId: string, port: Port) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = process.stages.findIndex((st) => st.id === stageId);
    if (idx === -1) return;
    const a = stagePos(idx, process.stages[idx]);
    setConnectFrom({ stageId, port });
    setConnectPos(portPos(a, port));
    setSelectedEdgeId(null);
    setSelectedStageId(stageId);
    setActiveTab('stage');
  };

  /** Drop a new connection onto a stage — snaps to the nearest port. */
  const handleNodePointerUp = (e: React.PointerEvent, stageId: string) => {
    if (!connectFrom || connectFrom.stageId === stageId) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = process.stages.findIndex((st) => st.id === stageId);
    if (idx === -1) return;
    const b = stagePos(idx, process.stages[idx]);
    const toPort = nearestPort(b, getWorldPos(e));
    addBranchWithPorts(connectFrom.stageId, connectFrom.port, stageId, toPort);
    setConnectFrom(null);
    setConnectPos(null);
  };

  /** Drop a new connection onto the Completed end node. */
  const handleEndPointerUp = (e: React.PointerEvent) => {
    if (!connectFrom) return;
    e.preventDefault();
    e.stopPropagation();
    const toPort = nearestPort(endNodePos, getWorldPos(e), true);
    const br = newBranch();
    br.label = 'Complete';
    br.targetType = 'completed';
    br.fromPort = connectFrom.port;
    br.toPort = toPort;
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((st) => (st.id === connectFrom.stageId ? { ...st, branches: [...st.branches, br] } : st)),
    }));
    setSelectedStageId(connectFrom.stageId);
    setActiveTab('stage');
    setConnectFrom(null);
    setConnectPos(null);
  };

  /** Drag the head/tail endpoint of an existing edge to re-attach it to another port. */
  const handleEdgePortPointerDown = (e: React.PointerEvent, branchId: string, side: 'from' | 'to') => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingEdgePort({ branchId, side });
  };

  const handleWorldPointerMove = (e: React.PointerEvent) => {
    // Edge endpoint re-attach (drag handle on a selected edge)
    if (draggingEdgePort) {
      const { branchId, side } = draggingEdgePort;
      const source = process.stages.find((st) => st.branches.some((b) => b.id === branchId));
      if (!source) return;
      const br = source.branches.find((b) => b.id === branchId);
      if (!br) return;
      const pos = getWorldPos(e);
      const srcIdx = process.stages.findIndex((st) => st.id === source.id);
      const srcPos = stagePos(srcIdx, source);
      if (side === 'from') {
        const port = nearestPort(srcPos, pos);
        updateBranch(source.id, branchId, { fromPort: port });
      } else if (br.targetType === 'completed') {
        const port = nearestPort(endNodePos, pos, true);
        updateBranch(source.id, branchId, { toPort: port });
      } else {
        const tIdx = process.stages.findIndex((st) => st.id === br.targetStageId);
        if (tIdx === -1) return;
        const tPos = stagePos(tIdx, process.stages[tIdx]);
        const port = nearestPort(tPos, pos);
        updateBranch(source.id, branchId, { toPort: port });
      }
      return;
    }
    // Live connect line from a port
    if (connectFrom && worldRef.current) {
      setConnectPos(getWorldPos(e));
      return;
    }
    if (!dragging || !worldRef.current) return;
    const rect = worldRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(CANVAS_W - NODE_W, e.clientX - rect.left - dragging.dx));
    const ny = Math.max(0, e.clientY - rect.top - dragging.dy);
    if (dragging.kind === 'end') {
      setEndPos({ x: nx, y: ny });
    } else {
      updateStage(dragging.id, { x: nx, y: ny });
    }
  };

  const handleWorldPointerUp = () => {
    setDragging(null);
    setDraggingEdgePort(null);
    setConnectFrom(null);
    setConnectPos(null);
  };

  const handleWorldDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'stage') {
        const rect = worldRef.current?.getBoundingClientRect();
        if (!rect) return;
        addStageAt(
          Math.max(0, Math.min(CANVAS_W - NODE_W, e.clientX - rect.left - NODE_W / 2)),
          Math.max(0, e.clientY - rect.top - 30),
        );
      }
    } catch { /* ignore */ }
  };

  const handleStageDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = e.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.type === 'event') addEventToStage(stageId, parsed.eventType);
    } catch { /* ignore */ }
  };

  const totalEvents = process.stages.reduce((n, s) => n + s.events.length, 0);
  const totalBranches = process.stages.reduce((n, s) => n + s.branches.length, 0);

  // Expression validity is memoized — only re-validates when the process changes.
  const { invalidBranches, hasFallback } = useMemo(() => analyzeExpressions(process), [process]);
  const jsonPreview = useMemo(() => JSON.stringify(process, null, 2), [process]);

  return (
    <div className="rb2-root">
      {/* Toolbar */}
      <div className="rb2-toolbar">
        <span className="rb2-toolbar__brand"><Workflow size={15} /> Routing Process Builder</span>

        <div className="rb2-mode-toggle" title="Layout mode">
          <button className={`rb2-mode-btn ${layoutMode === 'chain' ? 'rb2-mode-btn--active' : ''}`}
            onClick={() => setLayoutMode('chain')}>
            <ChevronsUpDown size={13} /> Chain
          </button>
          <button className={`rb2-mode-btn ${layoutMode === 'canvas' ? 'rb2-mode-btn--active' : ''}`}
            onClick={() => setLayoutMode('canvas')}>
            <Layers size={13} /> Canvas
          </button>
        </div>

        <input className="rb2-toolbar__name" value={process.name}
          onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))} placeholder="Process name" />

        <div className="rb2-toolbar__actions">
          <button className="sails-btn sails-btn--ghost sails-btn--sm">Cancel</button>
          <button className="sails-btn sails-btn--primary sails-btn--sm">Save Process</button>
        </div>
      </div>

      <div className="rb2-body">
        {/* LEFT: Palette */}
        <EventPalette />

        {/* CENTER: Canvas */}
        <WorkflowCanvas
          worldRef={worldRef}
          worldHeight={worldHeight}
          edges={edges}
          layoutMode={layoutMode}
          endNodePos={endNodePos}
          selectedEdgeId={selectedEdgeId}
          connectFrom={connectFrom}
          connectPos={connectPos}
          stages={process.stages}
          selectedStageId={selectedStageId}
          selectedEventId={selectedEventId}
          editingLabelStageId={editingLabelStageId}
          stagePos={stagePos}
          onWorldPointerMove={handleWorldPointerMove}
          onWorldPointerUp={handleWorldPointerUp}
          onWorldDrop={handleWorldDrop}
          onWorldClick={() => { setSelectedStageId(null); setSelectedEventId(null); setSelectedEdgeId(null); setActiveTab('workflow'); }}
          onStageSelect={(id) => { setSelectedStageId(id); setSelectedEventId(null); setActiveTab('stage'); }}
          onStagePointerDown={handleNodePointerDown}
          onStagePointerUp={handleNodePointerUp}
          onStageDrop={handleStageDrop}
          onStageMove={moveStage}
          onStageRemove={removeStage}
          onStageStartRename={(id) => { setSelectedStageId(id); setActiveTab('stage'); setEditingLabelStageId(id); }}
          onStageCommitRename={commitStageLabel}
          onSelectEvent={(id) => setSelectedEventId(id)}
          onAddBranch={addBranch}
          onPortPointerDown={handlePortPointerDown}
          onEdgeSelect={(branchId, sourceStageId) => {
            setSelectedEdgeId(branchId);
            if (sourceStageId) { setSelectedStageId(sourceStageId); setActiveTab('stage'); }
          }}
          onEdgePortPointerDown={handleEdgePortPointerDown}
          onEndPointerDown={handleEndPointerDown}
          onEndPointerUp={handleEndPointerUp}
        />

        {/* RIGHT: Properties */}
        <PropertiesPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          process={process}
          setProcess={setProcess}
          selectedStage={selectedStage}
          selectedEventId={selectedEventId}
          setSelectedEventId={setSelectedEventId}
          totalEvents={totalEvents}
          totalBranches={totalBranches}
          invalidBranches={invalidBranches}
          hasFallback={hasFallback}
          jsonPreview={jsonPreview}
          onUpdateStage={updateStage}
          onAddBranch={addBranch}
          onUpdateBranch={updateBranch}
          onRemoveBranch={removeBranch}
          onAddEvent={(stageId, type) => addEventToStage(stageId, type as WorkflowEvent['type'])}
          onMoveEvent={moveEvent}
          onRemoveEvent={removeEvent}
          onUpdateEventLabel={updateEventLabel}
          onUpdateEventConfig={updateEventConfig}
          onAddVariable={addVariable}
          onUpdateVariable={updateVariable}
          onRemoveVariable={removeVariable}
          onOpenExpressionModal={setExprModalEventId}
        />
      </div>

      {/* ── Large Expression / Transform modal ── */}
      {exprModalEvent && selectedStage && (
        <ExpressionModal
          event={exprModalEvent}
          stage={selectedStage}
          variables={process.variables}
          onUpdateConfig={(patch) => updateEventConfig(selectedStage.id, exprModalEvent.id, patch)}
          onClose={() => setExprModalEventId(null)}
        />
      )}
    </div>
  );
};

export default RouteBuilder;
