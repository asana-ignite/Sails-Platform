/**
 * MOCKUP — workflow stage card (prototype).
 */
import React from 'react';
import { Clock, Filter, Link2, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';
import { ALL_PORTS, EVENT_DEFS, NODE_H, NODE_W, ROUTER_TYPES } from '../constants';
import type { LayoutMode, Port, Pt, RouteStage, WorkflowEventType } from '../types';

export interface StageCardProps {
  stage: RouteStage;
  idx: number;
  pos: Pt;
  layoutMode: LayoutMode;
  isSelected: boolean;
  isConnectMode: boolean; // a connection is being drawn from a port
  isEditingLabel: boolean;
  totalStages: number;
  selectedEventId: string | null;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent, stageId: string) => void;
  onPointerUp: (e: React.PointerEvent, stageId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onStartRename: () => void;
  onCommitRename: (value: string) => void;
  onSelectEvent: (eventId: string | null) => void;
  onAddBranch: () => void;
  onPortPointerDown: (e: React.PointerEvent, stageId: string, port: Port) => void;
}

/** A single stage node on the canvas: name, badges, event chips, branch bar, ports. */
export const StageCard: React.FC<StageCardProps> = ({
  stage, idx, pos, layoutMode, isSelected, isConnectMode, isEditingLabel, totalStages,
  selectedEventId, onSelect, onPointerDown, onPointerUp, onDrop, onMove, onRemove,
  onStartRename, onCommitRename, onSelectEvent, onAddBranch, onPortPointerDown,
}) => {
  const routerInfo = ROUTER_TYPES.find((r) => r.type === stage.routerType);

  return (
    <div
      key={stage.id}
      className={`rb2-stage ${isSelected ? 'rb2-stage--selected' : ''} ${layoutMode === 'canvas' ? 'rb2-stage--canvas' : ''} ${isConnectMode ? 'rb2-stage--connectable' : ''}`}
      style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
      onPointerDown={(e) => onPointerDown(e, stage.id)}
      onPointerUp={(e) => onPointerUp(e, stage.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      <div className="rb2-stage__top">
        <span className="rb2-stage__num">{idx + 1}</span>
        {isEditingLabel ? (
          <input
            className="rb2-stage__name-input"
            defaultValue={stage.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCommitRename((e.target as HTMLInputElement).value); }
              if (e.key === 'Escape') { e.stopPropagation(); onCommitRename(stage.name); }
            }}
            onBlur={(e) => onCommitRename(e.target.value)}
          />
        ) : (
          <span
            className="rb2-stage__name"
            title="Double-click to rename"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
          >
            {stage.name}
          </span>
        )}
        <div className="rb2-stage__actions">
          {layoutMode === 'chain' && (
            <>
              <button className="rb2-icon-btn" title="Move up" onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={idx === 0}>
                <MoveUp size={12} />
              </button>
              <button className="rb2-icon-btn" title="Move down" onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={idx === totalStages - 1}>
                <MoveDown size={12} />
              </button>
            </>
          )}
          <button className="rb2-icon-btn rb2-icon-btn--danger" title="Delete stage" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="rb2-stage__badges">
        {routerInfo && (
          <span className="rb2-badge rb2-badge--router">{routerInfo.icon}{stage.routerLabel || routerInfo.label}</span>
        )}
        {stage.entryCondition && <span className="rb2-badge rb2-badge--cond"><Filter size={10} /> cond</span>}
        {stage.timeoutHours && <span className="rb2-badge rb2-badge--timeout"><Clock size={10} /> {stage.timeoutHours}h</span>}
        {stage.events.length > 0 && <span className="rb2-badge rb2-badge--events">{stage.events.length} events</span>}
      </div>

      <div className="rb2-stage__events">
        {stage.events.length === 0 ? (
          <span className="rb2-stage__events-empty">Drop a Workflow Event here</span>
        ) : (
          stage.events.slice(0, 3).map((ev) => {
            const def = EVENT_DEFS.find((d) => d.type === ev.type);
            const isEvSel = selectedEventId === ev.id;
            return (
              <span
                key={ev.id}
                className={`rb2-event-chip ${isEvSel ? 'rb2-event-chip--selected' : ''}`}
                style={{ borderColor: def?.color, color: def?.color }}
                title={`${ev.label} — click to select, Del to remove`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(isEvSel ? null : ev.id);
                }}
              >
                {def?.icon}
                <span>{ev.label}</span>
              </span>
            );
          })
        )}
        {stage.events.length > 3 && <span className="rb2-stage__events-more">+{stage.events.length - 3}</span>}
      </div>

      <div className="rb2-stage__branchbar">
        <Link2 size={11} />
        {stage.branches.length === 0 ? (
          <span className="rb2-stage__branch-empty">next →</span>
        ) : (
          <span className="rb2-stage__branch-count">{stage.branches.length} branch{stage.branches.length > 1 ? 'es' : ''}</span>
        )}
        <button
          className="rb2-stage__add-branch"
          title="Add outgoing branch"
          onClick={(e) => { e.stopPropagation(); onAddBranch(); }}
        >
          <Plus size={11} /> Branch
        </button>
      </div>

      {/* 4 connection ports */}
      {ALL_PORTS.map((p) => (
        <span
          key={p}
          className={`rb2-port rb2-port--${p} ${isConnectMode ? 'rb2-port--active' : ''}`}
          style={p === 'top' ? { top: -8, left: '50%', transform: 'translateX(-50%)' }
            : p === 'bottom' ? { bottom: -8, left: '50%', transform: 'translateX(-50%)' }
            : p === 'left' ? { left: -8, top: '50%', transform: 'translateY(-50%)' }
            : { right: -8, top: '50%', transform: 'translateY(-50%)' }}
          onPointerDown={(e) => onPortPointerDown(e, stage.id, p)}
          title={`Connect from ${p}`}
        />
      ))}
    </div>
  );
};

export default StageCard;
