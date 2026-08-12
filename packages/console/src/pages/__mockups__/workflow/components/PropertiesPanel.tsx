/**
 * MOCKUP — stage properties panel for the workflow prototype.
 */
import React from 'react';
import {
  AlertTriangle, CheckCircle2, MoveDown, MoveUp, Plus, Settings, Split, Trash2, X, Zap,
} from 'lucide-react';
import ExpressionEditor from '../../../../components/workflow/ExpressionEditor';
import { EVENT_DEFS, FIELD_TYPES, MOCK_MODELS, ROUTER_TYPES } from '../constants';
import type { BranchCondition, RouteStage, RouterType, RoutingProcess, WorkflowVariable } from '../types';
import { EventConfigForm } from './EventConfigForm';

export interface PropertiesPanelProps {
  activeTab: 'workflow' | 'stage';
  setActiveTab: (tab: 'workflow' | 'stage') => void;
  process: RoutingProcess;
  setProcess: React.Dispatch<React.SetStateAction<RoutingProcess>>;
  selectedStage: RouteStage | null;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  totalEvents: number;
  totalBranches: number;
  invalidBranches: BranchCondition[];
  hasFallback: boolean;
  jsonPreview: string;
  onUpdateStage: (stageId: string, patch: Partial<RouteStage>) => void;
  onAddBranch: (stageId: string) => void;
  onUpdateBranch: (stageId: string, branchId: string, patch: Partial<BranchCondition>) => void;
  onRemoveBranch: (stageId: string, branchId: string) => void;
  onAddEvent: (stageId: string, type: string) => void;
  onMoveEvent: (stageId: string, eventId: string, direction: 'up' | 'down') => void;
  onRemoveEvent: (stageId: string, eventId: string) => void;
  onUpdateEventLabel: (stageId: string, eventId: string, label: string) => void;
  onUpdateEventConfig: (stageId: string, eventId: string, patch: Record<string, any>) => void;
  onAddVariable: () => void;
  onUpdateVariable: (varId: string, patch: Partial<WorkflowVariable>) => void;
  onRemoveVariable: (varId: string) => void;
  onOpenExpressionModal: (eventId: string) => void;
}

/** RIGHT panel — Workflow / Stage tabs: settings, branches, events, variables, stats, validity. */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  activeTab, setActiveTab, process, setProcess, selectedStage, selectedEventId, setSelectedEventId,
  totalEvents, totalBranches, invalidBranches, hasFallback, jsonPreview,
  onUpdateStage, onAddBranch, onUpdateBranch, onRemoveBranch,
  onAddEvent, onMoveEvent, onRemoveEvent, onUpdateEventLabel, onUpdateEventConfig,
  onAddVariable, onUpdateVariable, onRemoveVariable, onOpenExpressionModal,
}) => {
  const selectedEvent = selectedStage ? selectedStage.events.find((e) => e.id === selectedEventId) || null : null;

  return (
    <div className="rb2-side">
      <div className="rb2-tabs">
        <button className={`rb2-tab ${activeTab === 'workflow' ? 'rb2-tab--active' : ''}`}
          onClick={() => setActiveTab('workflow')}>
          Workflow
        </button>
        <button className={`rb2-tab ${activeTab === 'stage' ? 'rb2-tab--active' : ''}`}
          onClick={() => setActiveTab('stage')}
          disabled={!selectedStage}>
          Stage
        </button>
      </div>

      {activeTab === 'stage' && selectedStage && (
        <div className="rb2-side__scroll">
          {/* ── Stage settings ── */}
          <div className="rb2-section">
            <h4 className="rb2-section-title">Stage Settings</h4>
            <div className="rb2-form-row">
              <label className="rb2-label">Stage Name</label>
              <input className="sails-input" value={selectedStage.name}
                onChange={(e) => onUpdateStage(selectedStage.id, { name: e.target.value })} />
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Router Type</label>
              <select className="sails-input" value={selectedStage.routerType}
                onChange={(e) => onUpdateStage(selectedStage.id, { routerType: e.target.value as RouterType })}>
                {ROUTER_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
              </select>
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">{selectedStage.routerType === 'field' ? 'Field Name' : 'Router Value'}</label>
              <input className="sails-input" value={selectedStage.routerValue}
                onChange={(e) => onUpdateStage(selectedStage.id, { routerValue: e.target.value })} />
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Display Label</label>
              <input className="sails-input" value={selectedStage.routerLabel}
                onChange={(e) => onUpdateStage(selectedStage.id, { routerLabel: e.target.value })} />
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Entry Condition</label>
              <input className="sails-input rb2-code" placeholder="e.g. amount > 50000"
                value={selectedStage.entryCondition}
                onChange={(e) => onUpdateStage(selectedStage.id, { entryCondition: e.target.value })} />
            </div>
            <div className="rb2-form-row rb2-check-row">
              <label className="rb2-check"><input type="checkbox" checked={selectedStage.canApprove}
                onChange={(e) => onUpdateStage(selectedStage.id, { canApprove: e.target.checked })} /> Approve</label>
              <label className="rb2-check"><input type="checkbox" checked={selectedStage.canReject}
                onChange={(e) => onUpdateStage(selectedStage.id, { canReject: e.target.checked })} /> Reject</label>
              <label className="rb2-check"><input type="checkbox" checked={selectedStage.canComment}
                onChange={(e) => onUpdateStage(selectedStage.id, { canComment: e.target.checked })} /> Comment</label>
              <label className="rb2-check"><input type="checkbox" checked={selectedStage.canReassign}
                onChange={(e) => onUpdateStage(selectedStage.id, { canReassign: e.target.checked })} /> Reassign</label>
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Timeout (hours)</label>
              <input className="sails-input" type="number" min={0} value={selectedStage.timeoutHours ?? ''}
                placeholder="No timeout"
                onChange={(e) => onUpdateStage(selectedStage.id, { timeoutHours: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>

          {/* ── Branches ── */}
          <div className="rb2-section">
            <div className="rb2-section-head">
              <h4 className="rb2-section-title"><Split size={11} /> Outgoing Branches</h4>
              <button className="rb2-add-btn" onClick={() => onAddBranch(selectedStage.id)}><Plus size={12} /> Branch</button>
            </div>
            {selectedStage.branches.length === 0 ? (
              <p className="rb2-hint">No branches — this stage flows to the next stage by default.</p>
            ) : (
              selectedStage.branches.map((br, bi) => (
                <div key={br.id} className="rb2-branch-row">
                  <div className="rb2-branch-row__head">
                    <span className="rb2-branch-seq">{bi + 1}</span>
                    <span className="rb2-branch-label-inline">Line to</span>
                    <select className="sails-input" value={br.targetType === 'completed' ? '__completed__' : br.targetStageId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__completed__') onUpdateBranch(selectedStage.id, br.id, { targetType: 'completed', targetStageId: undefined });
                        else onUpdateBranch(selectedStage.id, br.id, { targetType: 'stage', targetStageId: v });
                      }}>
                      <option value="__completed__">Completed</option>
                      {process.stages.filter((st) => st.id !== selectedStage.id).map((st, i) => (
                        <option key={st.id} value={st.id}>{i + 1} — {st.name}</option>
                      ))}
                    </select>
                    <button className="rb2-icon-btn rb2-icon-btn--danger" title="Delete branch"
                      onClick={() => onRemoveBranch(selectedStage.id, br.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="rb2-branch-row__cond">
                    <input className="sails-input" placeholder="Line label (shown on the line)" value={br.label}
                      onChange={(e) => onUpdateBranch(selectedStage.id, br.id, { label: e.target.value })} />
                    <ExpressionEditor
                      compact
                      variables={process.variables.map((v) => ({ id: v.id, name: v.name, fieldType: v.fieldType }))}
                      value={br.expression}
                      onChange={(v) => onUpdateBranch(selectedStage.id, br.id, { expression: v })}
                      placeholder="JSONata condition (optional)"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Events ── */}
          <div className="rb2-section">
            <div className="rb2-section-head">
              <h4 className="rb2-section-title"><Zap size={11} /> Workflow Events</h4>
              <span className="rb2-hint">Drag from palette or use +</span>
            </div>
            <div className="rb2-event-add-row">
              {EVENT_DEFS.map((d) => (
                <button key={d.type} className="rb2-event-add"
                  style={{ color: d.color, borderColor: d.color }}
                  onClick={() => onAddEvent(selectedStage.id, d.type)}>
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
            {selectedStage.events.length === 0 ? (
              <p className="rb2-hint">No events. Drag a Workflow Event into the stage card.</p>
            ) : (
              <div className="rb2-event-list">
                {selectedStage.events.map((ev) => {
                  const def = EVENT_DEFS.find((d) => d.type === ev.type);
                  const isSel = selectedEventId === ev.id;
                  return (
                    <div key={ev.id}>
                      <div className={`rb2-event-item ${isSel ? 'rb2-event-item--selected' : ''}`}
                        onClick={() => setSelectedEventId(isSel ? null : ev.id)}>
                        <span className="rb2-event-item__icon" style={{ color: def?.color }}>{def?.icon}</span>
                        <span className="rb2-event-item__label">{ev.label}</span>
                        <button className="rb2-icon-btn" title="Move up"
                          onClick={(e) => { e.stopPropagation(); onMoveEvent(selectedStage.id, ev.id, 'up'); }}><MoveUp size={11} /></button>
                        <button className="rb2-icon-btn" title="Move down"
                          onClick={(e) => { e.stopPropagation(); onMoveEvent(selectedStage.id, ev.id, 'down'); }}><MoveDown size={11} /></button>
                        <button className="rb2-icon-btn rb2-icon-btn--danger" title="Remove event"
                          onClick={(e) => { e.stopPropagation(); onRemoveEvent(selectedStage.id, ev.id); }}><X size={11} /></button>
                      </div>
                      {isSel && (
                        <div className="rb2-event-config">
                          <EventConfigForm
                            event={ev}
                            variables={process.variables}
                            onUpdateLabel={(label) => onUpdateEventLabel(selectedStage.id, ev.id, label)}
                            onUpdateConfig={(patch) => onUpdateEventConfig(selectedStage.id, ev.id, patch)}
                            onOpenExpressionModal={() => onOpenExpressionModal(ev.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'workflow' && (
        <div className="rb2-side__scroll">
          {/* ── Process ── */}
          <div className="rb2-section">
            <h4 className="rb2-section-title">Process</h4>
            <div className="rb2-form-row">
              <label className="rb2-label">Name</label>
              <input className="sails-input" value={process.name}
                onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Description</label>
              <textarea className="sails-input rb2-textarea" value={process.description}
                onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="rb2-form-row">
              <label className="rb2-label">Table</label>
              <select className="sails-input" value={process.tableId}
                onChange={(e) => setProcess((p) => ({ ...p, tableId: e.target.value }))}>
                {MOCK_MODELS.map((m) => <option key={m} value={`t_${m.toLowerCase()}`}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* ── Variables ── */}
          <div className="rb2-section">
            <div className="rb2-section-head">
              <h4 className="rb2-section-title"><Settings size={11} /> Workflow Variables</h4>
              <button className="rb2-add-btn" onClick={onAddVariable}><Plus size={12} /> Add</button>
            </div>
            <span className="rb2-hint">Variables are typed with any platform field type and referenced as {'{{name}}'}.</span>
            {process.variables.map((v) => (
              <div key={v.id} className="rb2-var-row">
                <input className="sails-input rb2-var-name" placeholder="name" value={v.name}
                  onChange={(e) => onUpdateVariable(v.id, { name: e.target.value })} />
                <select className="sails-input rb2-var-type" value={v.fieldType}
                  onChange={(e) => onUpdateVariable(v.id, { fieldType: e.target.value })}>
                  {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
                <input className="sails-input rb2-var-default" placeholder="default" value={v.defaultValue ?? ''}
                  onChange={(e) => onUpdateVariable(v.id, { defaultValue: e.target.value })} />
                <button className="rb2-icon-btn rb2-icon-btn--danger" title="Delete variable"
                  onClick={() => onRemoveVariable(v.id)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          {/* ── Stats ── */}
          <div className="rb2-section rb2-stats">
            <h4 className="rb2-section-title">Process Stats</h4>
            <div className="rb2-stat"><span>Stages</span><strong>{process.stages.length}</strong></div>
            <div className="rb2-stat"><span>Branches</span><strong>{totalBranches}</strong></div>
            <div className="rb2-stat"><span>Workflow Events</span><strong>{totalEvents}</strong></div>
            <div className="rb2-stat"><span>Variables</span><strong>{process.variables.length}</strong></div>
          </div>

          {/* ── Validity ── */}
          <div className="rb2-section rb2-validity">
            <h4 className="rb2-section-title">
              {invalidBranches.length === 0
                ? <><CheckCircle2 size={11} /> Expressions valid</>
                : <><AlertTriangle size={11} /> {invalidBranches.length} invalid expression{invalidBranches.length > 1 ? 's' : ''}</>}
            </h4>
            <p className="rb2-hint">
              {invalidBranches.length > 0
                ? 'One or more branch conditions contain a JSONata syntax error — fix them before saving.'
                : hasFallback
                  ? 'Stages without branches flow to the next stage (or Completed) automatically.'
                  : 'All branch expressions are valid.'}
            </p>
          </div>

          {/* ── JSON preview ── */}
          <div className="rb2-section">
            <h4 className="rb2-section-title">JSON Preview</h4>
            <pre className="rb2-json">{jsonPreview}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;
