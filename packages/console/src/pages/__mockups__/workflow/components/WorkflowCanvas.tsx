import React from 'react';
import { Flag } from 'lucide-react';
import { ALL_PORTS, CANVAS_W, END_H, NODE_H, NODE_W } from '../constants';
import { edgeMidpoint, edgePath, endPortPos, portPos } from '../geometry';
import type { LayoutMode, Port, Pt, RouteStage, WorkflowEdge } from '../types';
import { StageCard } from './StageCard';

export interface WorkflowCanvasProps {
  worldRef: React.RefObject<HTMLDivElement>;
  worldHeight: number;
  edges: WorkflowEdge[];
  layoutMode: LayoutMode;
  endNodePos: Pt;
  selectedEdgeId: string | null;
  connectFrom: { stageId: string; port: Port } | null;
  connectPos: Pt | null;
  stages: RouteStage[];
  selectedStageId: string | null;
  selectedEventId: string | null;
  editingLabelStageId: string | null;
  stagePos: (idx: number, s: RouteStage) => Pt;
  onWorldPointerMove: (e: React.PointerEvent) => void;
  onWorldPointerUp: () => void;
  onWorldDrop: (e: React.DragEvent) => void;
  onWorldClick: () => void;
  onStageSelect: (stageId: string) => void;
  onStagePointerDown: (e: React.PointerEvent, stageId: string) => void;
  onStagePointerUp: (e: React.PointerEvent, stageId: string) => void;
  onStageDrop: (e: React.DragEvent, stageId: string) => void;
  onStageMove: (stageId: string, direction: 'up' | 'down') => void;
  onStageRemove: (stageId: string) => void;
  onStageStartRename: (stageId: string) => void;
  onStageCommitRename: (stageId: string, value: string) => void;
  onSelectEvent: (eventId: string | null) => void;
  onAddBranch: (stageId: string) => void;
  onPortPointerDown: (e: React.PointerEvent, stageId: string, port: Port) => void;
  onEdgeSelect: (branchId: string, sourceStageId?: string) => void;
  onEdgePortPointerDown: (e: React.PointerEvent, branchId: string, side: 'from' | 'to') => void;
  onEndPointerDown: (e: React.PointerEvent) => void;
  onEndPointerUp: (e: React.PointerEvent) => void;
}

/** CENTER panel — the draggable world: SVG edges overlay + stage cards + Completed node. */
export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  worldRef, worldHeight, edges, layoutMode, endNodePos, selectedEdgeId,
  connectFrom, connectPos, stages, selectedStageId, selectedEventId, editingLabelStageId,
  stagePos, onWorldPointerMove, onWorldPointerUp, onWorldDrop, onWorldClick,
  onStageSelect, onStagePointerDown, onStagePointerUp, onStageDrop, onStageMove,
  onStageRemove, onStageStartRename, onStageCommitRename, onSelectEvent, onAddBranch,
  onPortPointerDown, onEdgeSelect, onEdgePortPointerDown, onEndPointerDown, onEndPointerUp,
}) => {
  return (
    <div className="rb2-canvas">
      <div
        className="rb2-world"
        ref={worldRef}
        style={{ width: CANVAS_W, height: worldHeight }}
        onPointerMove={onWorldPointerMove}
        onPointerUp={onWorldPointerUp}
        onDrop={onWorldDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={onWorldClick}
      >
        <svg className="rb2-edges" width={CANVAS_W} height={worldHeight}>
          <defs>
            <marker id="rb2-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="var(--sails-border,#94a3b8)" />
            </marker>
            <marker id="rb2-arrow-branch" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" />
            </marker>
          </defs>
          {edges.map((e) => {
            const isBranch = e.kind === 'branch';
            const isSel = selectedEdgeId === e.id;
            const bW = NODE_W;
            const bH = e.isEndTarget ? END_H : NODE_H;
            const mid = edgeMidpoint(e.a, e.b, e.fromPort, e.toPort, NODE_W, NODE_H, bW, bH);
            const color = isBranch ? '#3b82f6' : 'var(--sails-border,#94a3b8)';
            const handleFrom = portPos(e.a, e.fromPort, NODE_W, NODE_H);
            const handleTo = portPos(e.b, e.toPort, bW, bH);
            return (
              <g key={e.id} className={`rb2-edge ${isSel ? 'rb2-edge--selected' : ''}`}>
                <path
                  d={edgePath(e.a, e.b, e.fromPort, e.toPort, NODE_W, NODE_H, bW, bH)}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSel ? 3 : (isBranch ? 2 : 1.6)}
                  strokeDasharray={isBranch ? undefined : '2 4'}
                  markerEnd={isBranch ? 'url(#rb2-arrow-branch)' : 'url(#rb2-arrow)'}
                  className={e.branchId ? 'rb2-edge-path--clickable' : ''}
                  onClick={(ev) => {
                    if (!e.branchId) return;
                    ev.stopPropagation();
                    onEdgeSelect(e.branchId, e.sourceStageId);
                  }}
                />
                {e.label && (
                  <g pointerEvents="none">
                    <rect x={mid.x - 45} y={mid.y - 11} width={90} height={22} rx={11}
                      fill="rgba(255,255,255,0.95)" stroke={color} strokeWidth={1} />
                    <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={10}
                      fill="#1e293b" fontWeight={600} pointerEvents="none">
                      {e.label}
                    </text>
                  </g>
                )}
                {isSel && e.branchId && (
                  <g className="rb2-edge-handles">
                    <circle
                      cx={handleFrom.x} cy={handleFrom.y} r={8}
                      className="rb2-edge-handle"
                      onPointerDown={(ev) => onEdgePortPointerDown(ev, e.branchId!, 'from')}
                    >
                      <title>Drag to move start point</title>
                    </circle>
                    <circle
                      cx={handleTo.x} cy={handleTo.y} r={8}
                      className="rb2-edge-handle"
                      onPointerDown={(ev) => onEdgePortPointerDown(ev, e.branchId!, 'to')}
                    >
                      <title>Drag to move end point</title>
                    </circle>
                  </g>
                )}
              </g>
            );
          })}
          {connectFrom && connectPos && (() => {
            const srcIdx = stages.findIndex((st) => st.id === connectFrom.stageId);
            if (srcIdx === -1) return null;
            const srcPos = stagePos(srcIdx, stages[srcIdx]);
            const sp = portPos(srcPos, connectFrom.port);
            return (
              <line
                x1={sp.x} y1={sp.y} x2={connectPos.x} y2={connectPos.y}
                className="rb2-connect-temp"
                stroke="var(--sails-primary,#9dcee0)"
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd="url(#rb2-arrow-branch)"
              />
            );
          })()}
        </svg>

        {stages.map((s, idx) => (
          <StageCard
            key={s.id}
            stage={s}
            idx={idx}
            pos={stagePos(idx, s)}
            layoutMode={layoutMode}
            isSelected={selectedStageId === s.id}
            isConnectMode={!!connectFrom}
            isEditingLabel={editingLabelStageId === s.id}
            totalStages={stages.length}
            selectedEventId={selectedEventId}
            onSelect={() => onStageSelect(s.id)}
            onPointerDown={onStagePointerDown}
            onPointerUp={onStagePointerUp}
            onDrop={onStageDrop}
            onMove={(dir) => onStageMove(s.id, dir)}
            onRemove={() => onStageRemove(s.id)}
            onStartRename={() => onStageStartRename(s.id)}
            onCommitRename={(value) => onStageCommitRename(s.id, value)}
            onSelectEvent={onSelectEvent}
            onAddBranch={() => onAddBranch(s.id)}
            onPortPointerDown={onPortPointerDown}
          />
        ))}

        {/* Completed end node */}
        <div
          className={`rb2-end ${layoutMode === 'canvas' ? 'rb2-end--canvas' : ''}`}
          style={{ left: endNodePos.x, top: endNodePos.y, width: NODE_W, height: END_H }}
          onPointerDown={onEndPointerDown}
          onPointerUp={(e) => onEndPointerUp(e)}
        >
          <span className="rb2-end__icon"><Flag size={14} /></span>
          <span className="rb2-end__label">Completed</span>
          {ALL_PORTS.map((p) => (
            <span
              key={p}
              className={`rb2-port rb2-port--${p} rb2-port--end ${connectFrom ? 'rb2-port--active' : ''}`}
              style={p === 'top' ? { top: -8, left: '50%', transform: 'translateX(-50%)' }
                : p === 'bottom' ? { bottom: -8, left: '50%', transform: 'translateX(-50%)' }
                : p === 'left' ? { left: -8, top: '50%', transform: 'translateY(-50%)' }
                : { right: -8, top: '50%', transform: 'translateY(-50%)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
