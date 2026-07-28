/**
 * MOCK UP — Routing Process Builder
 *
 * Separate from the Form/Layout Builder.
 * Visual stage chain with drag-and-drop reordering.
 * Defines who routes what and what happens at each stage.
 */
import React, { useState } from 'react';
import {
  Plus, X, GripVertical, MoveUp, MoveDown, Trash2,
  ArrowRight, GitBranch, User, Users, Briefcase, Shield,
  Hash, Clock, Zap, MessageSquare, Webhook, Settings,
  ChevronDown, ChevronRight, Filter, Target,
} from 'lucide-react';
import './RouteBuilder.css';

// ─── Types ────────────────────────────────────────────────────

type RouterType = 'user' | 'team' | 'position' | 'role' | 'field';
type ActionTrigger = 'on_approve' | 'on_reject' | 'on_timeout';

interface RouteAction {
  id: string;
  type: 'update_field' | 'send_notification' | 'call_webhook' | 'create_task';
  label: string;
  config: Record<string, string>;
}

interface RouteStage {
  id: string;
  name: string;
  description: string;
  routerType: RouterType;
  routerValue: string;
  routerLabel: string;
  canApprove: boolean;
  canReject: boolean;
  canComment: boolean;
  canReassign: boolean;
  timeoutHours: number | null;
  entryCondition: string;
  onApprove: RouteAction[];
  onReject: RouteAction[];
  onTimeout: RouteAction[];
}

interface RoutingProcess {
  name: string;
  description: string;
  tableId: string;
  stages: RouteStage[];
}

// ─── Router type definitions ──────────────────────────────────

const ROUTER_TYPES: { type: RouterType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'user',     label: 'Specific User',   icon: <User size={14} />,     desc: 'Route to a named user' },
  { type: 'team',     label: 'Team',            icon: <Users size={14} />,    desc: 'All members of a team' },
  { type: 'position', label: 'Position',        icon: <Briefcase size={14} />, desc: 'Anyone holding a position' },
  { type: 'role',     label: 'Role',            icon: <Shield size={14} />,   desc: 'Anyone with a specific role' },
  { type: 'field',    label: 'Record Field',    icon: <Hash size={14} />,     desc: 'Dynamic — user in a record field' },
];

const ACTION_TYPES = [
  { type: 'update_field' as const,   label: 'Update Field',     icon: <Target size={12} /> },
  { type: 'send_notification' as const, label: 'Send Notification', icon: <MessageSquare size={12} /> },
  { type: 'call_webhook' as const,   label: 'Call Webhook',     icon: <Webhook size={12} /> },
  { type: 'create_task' as const,    label: 'Create Task',      icon: <Zap size={12} /> },
];

// ─── Helpers ──────────────────────────────────────────────────

function newStage(): RouteStage {
  return {
    id: `stage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'New Stage',
    description: '',
    routerType: 'user',
    routerValue: '',
    routerLabel: '',
    canApprove: true,
    canReject: true,
    canComment: true,
    canReassign: false,
    timeoutHours: null,
    entryCondition: '',
    onApprove: [],
    onReject: [],
    onTimeout: [],
  };
}

function newAction(trigger: ActionTrigger, type: RouteAction['type']): RouteAction {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
    type,
    label: type === 'update_field' ? 'Update Field' : type === 'send_notification' ? 'Notify' : type === 'call_webhook' ? 'Webhook' : 'Create Task',
    config: {},
  };
}

// ─── Main Component ───────────────────────────────────────────

export const RouteBuilder: React.FC = () => {
  const [process, setProcess] = useState<RoutingProcess>({
    name: 'Contract Review',
    description: 'Route contracts through Legal → Finance sign-off',
    tableId: 't_contracts',
    stages: [],
  });
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const toggleExpand = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(stageId) ? next.delete(stageId) : next.add(stageId);
      return next;
    });
    setSelectedStageId(stageId);
  };

  const addStage = () => {
    setProcess((p) => ({ ...p, stages: [...p.stages, newStage()] }));
  };

  const removeStage = (stageId: string) => {
    setProcess((p) => ({ ...p, stages: p.stages.filter((s) => s.id !== stageId) }));
    if (selectedStageId === stageId) setSelectedStageId(null);
  };

  const updateStage = (stageId: string, patch: Partial<RouteStage>) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
    }));
  };

  const moveStage = (stageId: string, direction: 'up' | 'down') => {
    setProcess((p) => {
      const stages = [...p.stages];
      const idx = stages.findIndex((s) => s.id === stageId);
      if (idx === -1) return p;
      const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (otherIdx < 0 || otherIdx >= stages.length) return p;
      [stages[idx], stages[otherIdx]] = [stages[otherIdx], stages[idx]];
      return { ...p, stages };
    });
  };

  const addAction = (stageId: string, trigger: ActionTrigger, type: RouteAction['type']) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => {
        if (s.id !== stageId) return s;
        const key = trigger as string;
        return { ...s, [key]: [...(s[key as keyof Pick<RouteStage, 'onApprove' | 'onReject' | 'onTimeout'>] as RouteAction[]), newAction(trigger, type)] };
      }),
    }));
  };

  const removeAction = (stageId: string, trigger: ActionTrigger, actionId: string) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => {
        if (s.id !== stageId) return s;
        const key = trigger as string;
        return { ...s, [key]: ((s[key as keyof Pick<RouteStage, 'onApprove' | 'onReject' | 'onTimeout'>] as RouteAction[]) || []).filter((a: RouteAction) => a.id !== actionId) };
      }),
    }));
  };

  const updateAction = (stageId: string, trigger: ActionTrigger, actionId: string, patch: Partial<RouteAction>) => {
    setProcess((p) => ({
      ...p,
      stages: p.stages.map((s) => {
        if (s.id !== stageId) return s;
        const key = trigger as string;
        return { ...s, [key]: ((s[key as keyof Pick<RouteStage, 'onApprove' | 'onReject' | 'onTimeout'>] as RouteAction[]) || []).map((a: RouteAction) => a.id === actionId ? { ...a, ...patch } : a) };
      }),
    }));
  };

  // Drag & drop stages
  const handleStageDragStart = (e: React.DragEvent, stageId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ stageId, type: 'stage' }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleStageDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    try {
      const { stageId } = JSON.parse(e.dataTransfer.getData('application/json'));
      setProcess((p) => {
        const stages = [...p.stages];
        const sourceIdx = stages.findIndex((s) => s.id === stageId);
        if (sourceIdx === -1 || sourceIdx === targetIdx) return p;
        const [removed] = stages.splice(sourceIdx, 1);
        stages.splice(targetIdx, 0, removed);
        return { ...p, stages };
      });
    } catch {}
  };

  const selectedStage = process.stages.find((s) => s.id === selectedStageId) || null;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="rb-root">
      {/* ── Toolbar ── */}
      <div className="rb-toolbar">
        <span className="rb-toolbar__brand">Routing Process Builder</span>
        <div className="rb-toolbar__actions">
          <button className="sails-btn sails-btn--ghost sails-btn--sm">Cancel</button>
          <button className="sails-btn sails-btn--primary sails-btn--sm">Save Process</button>
        </div>
      </div>

      <div className="rb-body">
        {/* ── CENTER: Stage Chain ── */}
        <div className="rb-canvas">
          <div className="rb-canvas__scroll">
            {/* Process Settings */}
            <div className="rb-process-header">
              <div className="rb-process-header__icon">
                <GitBranch size={20} />
              </div>
              <div className="rb-process-header__info">
                <input
                  className="rb-process-name"
                  value={process.name}
                  onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Process Name"
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span className="rb-badge">Table: Contracts</span>
                  <input
                    className="rb-process-desc"
                    value={process.description}
                    onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Description..."
                    style={{ border: 'none', background: 'none', fontSize: 12, color: 'var(--sails-text-muted)', flex: 1 }}
                  />
                </div>
              </div>
            </div>

            {/* Stage list */}
            <div className="rb-chain">
              {process.stages.length === 0 ? (
                <div className="rb-chain__empty">
                  <p>No stages defined yet. Click <strong>+ Add Stage</strong> to build your routing flow.</p>
                </div>
              ) : (
                process.stages.map((stage, idx) => {
                  const isExpanded = expandedStages.has(stage.id);
                  const isSelected = selectedStageId === stage.id;
                  const isLast = idx === process.stages.length - 1;
                  const routerInfo = ROUTER_TYPES.find((r) => r.type === stage.routerType);
                  const totalActions = stage.onApprove.length + stage.onReject.length + (stage.timeoutHours ? stage.onTimeout.length : 0);

                  return (
                    <React.Fragment key={stage.id}>
                      {/* Drop zone before stage */}
                      <div
                        className={`rb-drop-zone ${dragOverIdx === idx ? 'rb-drop-zone--active' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={(e) => handleStageDrop(e, idx)}
                      />

                      {/* Stage card */}
                      <div
                        className={`rb-stage ${isSelected ? 'rb-stage--selected' : ''} ${isExpanded ? 'rb-stage--expanded' : ''}`}
                        draggable
                        onDragStart={(e) => handleStageDragStart(e, stage.id)}
                      >
                        {/* Stage header (always visible) */}
                        <div className="rb-stage__header" onClick={() => toggleExpand(stage.id)}>
                          <div className="rb-stage__order">
                            <span className="rb-stage__number">{idx + 1}</span>
                          </div>
                          <button className="rb-stage__drag" onClick={(e) => e.stopPropagation()}>
                            <GripVertical size={14} />
                          </button>
                          <div className="rb-stage__main-info">
                            <span className="rb-stage__name">{stage.name}</span>
                            <div className="rb-stage__meta">
                              {routerInfo && (
                                <span className="rb-stage__router">
                                  {routerInfo.icon}
                                  <span>{stage.routerLabel || routerInfo.label}</span>
                                </span>
                              )}
                              {stage.entryCondition && (
                                <span className="rb-stage__cond-badge" title={stage.entryCondition}>
                                  <Filter size={10} /> conditional
                                </span>
                              )}
                              {totalActions > 0 && (
                                <span className="rb-stage__action-badge">{totalActions} actions</span>
                              )}
                              {stage.timeoutHours && (
                                <span className="rb-stage__timeout-badge" title={`${stage.timeoutHours}h timeout`}>
                                  <Clock size={10} /> {stage.timeoutHours}h
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rb-stage__header-actions">
                            <button className="rb-icon-btn" onClick={(e) => { e.stopPropagation(); moveStage(stage.id, 'up'); }} disabled={idx === 0} title="Move up">
                              <MoveUp size={13} />
                            </button>
                            <button className="rb-icon-btn" onClick={(e) => { e.stopPropagation(); moveStage(stage.id, 'down'); }} disabled={isLast} title="Move down">
                              <MoveDown size={13} />
                            </button>
                            <button className="rb-icon-btn rb-icon-btn--danger" onClick={(e) => { e.stopPropagation(); removeStage(stage.id); }} title="Delete stage">
                              <Trash2 size={13} />
                            </button>
                            <div className={`rb-stage__expand-icon ${isExpanded ? 'rb-stage__expand-icon--open' : ''}`}>
                              <ChevronDown size={14} />
                            </div>
                          </div>
                        </div>

                        {/* Stage body (expandable) */}
                        {isExpanded && (
                          <div className="rb-stage__body">
                            <div className="rb-stage__form-grid">
                              {/* Name */}
                              <div className="rb-form-group rb-form-group--half">
                                <label className="rb-form-label">Stage Name</label>
                                <input className="sails-input" value={stage.name} onChange={(e) => updateStage(stage.id, { name: e.target.value })} />
                              </div>

                              {/* Router Type */}
                              <div className="rb-form-group rb-form-group--half">
                                <label className="rb-form-label">Router Type</label>
                                <select className="sails-input" value={stage.routerType} onChange={(e) => updateStage(stage.id, { routerType: e.target.value as RouterType })}>
                                  {ROUTER_TYPES.map((r) => (
                                    <option key={r.type} value={r.type}>{r.label} — {r.desc}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Router Value */}
                              <div className="rb-form-group rb-form-group--half">
                                <label className="rb-form-label">
                                  {stage.routerType === 'field' ? 'Field Name (dynamic)' : 'Router Value'}
                                </label>
                                <input className="sails-input" value={stage.routerValue}
                                  placeholder={stage.routerType === 'user' ? 'e.g. user@somsak' : stage.routerType === 'team' ? 'e.g. Legal Team' : stage.routerType === 'field' ? 'e.g. manager_id' : ''}
                                  onChange={(e) => updateStage(stage.id, { routerValue: e.target.value })} />
                              </div>

                              {/* Display Label */}
                              <div className="rb-form-group rb-form-group--half">
                                <label className="rb-form-label">Display Label</label>
                                <input className="sails-input" value={stage.routerLabel} placeholder="e.g. Legal Counsel" onChange={(e) => updateStage(stage.id, { routerLabel: e.target.value })} />
                              </div>

                              {/* Entry Condition */}
                              <div className="rb-form-group rb-form-group--full">
                                <label className="rb-form-label">
                                  <Filter size={11} /> Entry Condition (expression)
                                </label>
                                <input className="sails-input rb-code-input" value={stage.entryCondition}
                                  placeholder='e.g. record.amount > 50000 && record.type === "enterprise"'
                                  onChange={(e) => updateStage(stage.id, { entryCondition: e.target.value })} />
                                <span className="rb-form-hint">Leave empty to always enter this stage. Uses record context variables.</span>
                              </div>

                              {/* Capabilities */}
                              <div className="rb-form-group rb-form-group--full rb-capabilities">
                                <label className="rb-form-label">Stage Capabilities</label>
                                <div className="rb-capabilities__grid">
                                  {([
                                    { key: 'canApprove' as const, label: 'Approve', icon: <ChevronDown size={12} /> },
                                    { key: 'canReject' as const, label: 'Reject', icon: <ChevronRight size={12} /> },
                                    { key: 'canComment' as const, label: 'Comment', icon: <MessageSquare size={12} /> },
                                    { key: 'canReassign' as const, label: 'Reassign', icon: <ArrowRight size={12} /> },
                                  ]).map((cap) => (
                                    <label key={cap.key} className={`rb-cap ${stage[cap.key] ? 'rb-cap--active' : ''}`}>
                                      <input type="checkbox" checked={stage[cap.key]}
                                        onChange={(e) => updateStage(stage.id, { [cap.key]: e.target.checked })} />
                                      {cap.icon} {cap.label}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Timeout */}
                              <div className="rb-form-group rb-form-group--half">
                                <label className="rb-form-label">
                                  <Clock size={11} /> Timeout (hours)
                                </label>
                                <input className="sails-input" type="number" value={stage.timeoutHours ?? ''}
                                  placeholder="No timeout"
                                  onChange={(e) => updateStage(stage.id, { timeoutHours: e.target.value ? Number(e.target.value) : null })} />
                              </div>
                            </div>

                            {/* Actions section */}
                            <div className="rb-actions-section">
                              <div className="rb-actions__grid">
                                {/* On Approve */}
                                <ActionBlock
                                  label="On Approve"
                                  color="green"
                                  trigger="on_approve"
                                  actions={stage.onApprove}
                                  onAdd={(type) => addAction(stage.id, 'on_approve', type)}
                                  onRemove={(actionId) => removeAction(stage.id, 'on_approve', actionId)}
                                  onUpdate={(actionId, patch) => updateAction(stage.id, 'on_approve', actionId, patch)}
                                />

                                {/* On Reject */}
                                <ActionBlock
                                  label="On Reject"
                                  color="red"
                                  trigger="on_reject"
                                  actions={stage.onReject}
                                  onAdd={(type) => addAction(stage.id, 'on_reject', type)}
                                  onRemove={(actionId) => removeAction(stage.id, 'on_reject', actionId)}
                                  onUpdate={(actionId, patch) => updateAction(stage.id, 'on_reject', actionId, patch)}
                                />

                                {/* On Timeout */}
                                {stage.timeoutHours && stage.timeoutHours > 0 && (
                                  <ActionBlock
                                    label="On Timeout"
                                    color="orange"
                                    trigger="on_timeout"
                                    actions={stage.onTimeout}
                                    onAdd={(type) => addAction(stage.id, 'on_timeout', type)}
                                    onRemove={(actionId) => removeAction(stage.id, 'on_timeout', actionId)}
                                    onUpdate={(actionId, patch) => updateAction(stage.id, 'on_timeout', actionId, patch)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {!isLast && (
                        <div className="rb-connector">
                          <div className="rb-connector__line" />
                          <div className="rb-connector__arrow">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {/* Drop zone at end */}
              {process.stages.length > 0 && (
                <div
                  className={`rb-drop-zone ${dragOverIdx === process.stages.length ? 'rb-drop-zone--active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(process.stages.length); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => handleStageDrop(e, process.stages.length)}
                />
              )}

              {/* Add stage button */}
              <button className="rb-add-stage-btn" onClick={addStage}>
                <Plus size={16} /> Add Stage
              </button>
            </div>

            {/* Process end */}
            <div className="rb-end-node">
              <div className="rb-end-node__icon">
                <Target size={18} />
              </div>
              <span className="rb-end-node__label">Completed</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Context Help ── */}
        <div className="rb-context">
          <h3 className="rb-panel-title"><Settings size={13} /> Process Info</h3>

          <div className="rb-context__card">
            <div className="rb-context__row">
              <span className="rb-context__key">Stages</span>
              <span className="rb-context__value">{process.stages.length}</span>
            </div>
            <div className="rb-context__row">
              <span className="rb-context__key">Table</span>
              <span className="rb-context__value">Contracts</span>
            </div>
            <div className="rb-context__row">
              <span className="rb-context__key">Total Actions</span>
              <span className="rb-context__value">
                {process.stages.reduce((sum, s) => sum + s.onApprove.length + s.onReject.length + s.onTimeout.length, 0)}
              </span>
            </div>
          </div>

          <div className="rb-context__help">
            <h4 className="rb-context__help-title">How Routing Works</h4>
            <p>When a record enters this process, it moves through stages sequentially. At each stage, the designated router must approve or reject.</p>
            <ul className="rb-context__help-list">
              <li><strong>Router</strong> — who decides at this stage</li>
              <li><strong>Entry Condition</strong> — skip this stage unless condition is met</li>
              <li><strong>Actions</strong> — automatic side effects (update fields, notify, webhooks)</li>
              <li><strong>Timeout</strong> — auto-escalation if no response within N hours</li>
            </ul>
          </div>

          {selectedStage && (
            <div className="rb-context__preview">
              <h4 className="rb-context__help-title">JSON Preview</h4>
              <pre className="rb-context__json">
                {JSON.stringify(selectedStage, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-component: Action Block ──────────────────────────────

interface ActionBlockProps {
  label: string;
  color: 'green' | 'red' | 'orange';
  trigger: ActionTrigger;
  actions: RouteAction[];
  onAdd: (type: RouteAction['type']) => void;
  onRemove: (actionId: string) => void;
  onUpdate: (actionId: string, patch: Partial<RouteAction>) => void;
}

const ACTION_COLORS = {
  green:  { bg: 'rgba(16, 185, 129, 0.06)', border: '#10b981', text: '#10b981' },
  red:    { bg: 'rgba(239, 68, 68, 0.06)',  border: '#ef4444', text: '#ef4444' },
  orange: { bg: 'rgba(245, 158, 11, 0.06)', border: '#f59e0b', text: '#f59e0b' },
};

const ActionBlock: React.FC<ActionBlockProps> = ({ label, color, actions, onAdd, onRemove, onUpdate }) => {
  const c = ACTION_COLORS[color];
  return (
    <div className="rb-action-block" style={{ background: c.bg, borderColor: c.border }}>
      <div className="rb-action-block__header">
        <span style={{ fontWeight: 600, fontSize: 12, color: c.text }}>{label}</span>
        <div className="rb-action-block__add-menu">
          {ACTION_TYPES.map((at) => (
            <button key={at.type} className="rb-action-add-btn" onClick={() => onAdd(at.type)} title={`Add ${at.label}`}>
              {at.icon} <span>{at.label}</span>
            </button>
          ))}
        </div>
      </div>
      {actions.length === 0 ? (
        <p className="rb-action-empty">No actions. Click an action button above to add one.</p>
      ) : (
        <div className="rb-action-list">
          {actions.map((action) => (
            <div key={action.id} className="rb-action-item">
              <span className="rb-action-item__type">
                {ACTION_TYPES.find((a) => a.type === action.type)?.icon}
                <span>{action.label}</span>
              </span>
              <button className="rb-icon-btn rb-icon-btn--danger" onClick={() => onRemove(action.id)}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteBuilder;
