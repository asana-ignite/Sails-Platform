/**
 * ExitConditionsEditor — SHARED editor for a stage's Exit Conditions (the
 * outgoing lines of an approval stage).
 *
 * Used in two places (single source of truth — enhanced once, appears both):
 *   1. Workflow Studio → Stage Properties ("Exit Conditions" section)
 *   2. Task Approval event wizard → "Exit" tab (last tab)
 *
 * Renders the line list with per-line config modal (click a chip to edit).
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import { ExpressionEditor } from './ExpressionEditor';
import { CustomSelect } from '../common/CustomSelect';
import type { DrillRoots } from './jsonataSuggest';
import './ExitConditionsEditor.css';

export interface WorkflowExitLine {
  id: string;
  label: string;
  expression: string;
  /** The approval decision this line follows (one of `actions`). */
  action?: string;
  votePolicy?: 'all' | 'any' | 'at_least';
  voteCount?: number;
  targetType?: string;
  targetStageId?: string;
}

/** The editable fields of an exit line (what Add / inline-edit emit). */
export interface ExitLinePatch {
  label?: string;
  expression?: string;
  action?: string | undefined;
  votePolicy?: 'all' | 'any' | 'at_least' | undefined;
  voteCount?: number | undefined;
}

/** Expression-editor context — keeps intellisense; falls back to a textarea. */
export interface ExitEditorExprContext {
  variables: { id: string; name: string; fieldType: string; targetModel?: string; columns?: any[] }[];
  recordSchemas?: any;
  drillRoots?: DrillRoots;
}

/** The line's display name — its Label (falls back to the bound decision's
 *  label when the name is empty). The bound decision / vote policy are shown
 *  as hover detail via exitConditionTooltip, never in the name itself. */
export function exitConditionSummary(br: WorkflowExitLine, labels: Record<string, string> = {}): string {
  const label = (br.label || '').trim();
  if (label) return label;
  return br.action ? (labels[br.action] || br.action) : '';
}

/** Full hover detail for a line: name → target · decision · vote policy. */
export function exitConditionTooltip(br: WorkflowExitLine, labels: Record<string, string> = {}): string {
  const name = exitConditionSummary(br, labels);
  const target = br.targetType === 'completed' ? 'Completed' : 'stage';
  const pol = br.votePolicy === 'at_least'
    ? `At least ${br.voteCount ?? 1}`
    : br.votePolicy === 'all' ? 'All' : br.votePolicy === 'any' ? 'Any one' : '';
  const decision = br.action ? (labels[br.action] || br.action) : '';
  return [name, target, decision && `Decision: ${decision}`, pol && `Votes: ${pol}`].filter(Boolean).join(' · ');
}

export interface ExitConditionsEditorProps {
  lines: WorkflowExitLine[];
  /** The available approval decisions (value + label). */
  actions: { value: string; label: string }[];
  /** Stage id → name, for target labels. */
  stageNames?: Record<string, string>;
  disabled?: boolean;
  /** Optional expression-editor context (intellisense); plain textarea otherwise. */
  expression?: ExitEditorExprContext;
  onAdd: (patch: ExitLinePatch) => string | void;
  onUpdate: (id: string, patch: ExitLinePatch) => void;
  onRemove: (id: string) => void;
}

interface Draft {
  label: string;
  action: string;
  votePolicy: 'all' | 'any' | 'at_least';
  voteCount: number;
  condition: string;
}

/** The per-line editor (used for the config modal). */
function LineEditor({
  draft, setDraft, actions, expression,
}: {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  actions: { value: string; label: string }[];
  expression?: ExitEditorExprContext;
}) {
  const decisionOptions = [
    { value: '', label: 'No decision (data only)' },
    ...actions.map((a) => ({ value: a.value, label: a.label })),
  ];
  const requiresOptions = [
    { value: 'at_least', label: 'At least' },
    { value: 'all', label: 'All assignees' },
    { value: 'any', label: 'Any one assignee' },
  ];
  return (
    <div className="ecl-editor">
      <div className="ws-props-group" style={{ paddingTop: 0 }}>
        <label className="ws-props-label">Name (Line Label)</label>
        <input className="ws-props-input" value={draft.label} onChange={(e) => setDraft({ label: e.target.value })} placeholder="e.g. Approve, Reject, Send to Director" />
      </div>

      <div className="ecl-editor__row">
        <div className="ws-props-group ecl-editor__col" style={{ paddingTop: 0 }}>
          <label className="ws-props-label">Requires</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }} className="ws-props-select">
              <CustomSelect size="md" searchable value={draft.votePolicy} options={requiresOptions}
                onChange={(v) => setDraft({ votePolicy: v as Draft['votePolicy'] })} />
            </div>
            {draft.votePolicy === 'at_least' && (
              <input className="ws-props-input" type="number" min={1} value={draft.voteCount} style={{ width: 68, flexShrink: 0 }}
                onChange={(e) => setDraft({ voteCount: parseInt(e.target.value, 10) || 1 })} />
            )}
          </div>
          <p className="ws-props-hint" style={{ paddingTop: 2 }}>e.g. 1 Approve = “At least 1”.</p>
        </div>
        <div className="ws-props-group ecl-editor__col" style={{ paddingTop: 0 }}>
          <label className="ws-props-label">Decision</label>
          <div className="ws-props-select">
            <CustomSelect size="md" searchable value={draft.action} options={decisionOptions}
              onChange={(v) => {
                const action = String(v);
                const patch: Partial<Draft> = { action };
                // Name the line from the decision unless the user gave it a
                // custom name — keeps every exit condition uniquely labeled.
                const act = actions.find((a) => a.value === action);
                const lbl = (draft.label || '').trim().toLowerCase();
                if (act && (!lbl || lbl === 'new exit' || lbl === 'new branch')) patch.label = act.label;
                setDraft(patch);
              }} />
          </div>
        </div>
      </div>

      <div className="ws-props-group">
        <label className="ws-props-label">AND Condition (optional JSONata)</label>
        {expression ? (
          <ExpressionEditor
            compact
            variables={expression.variables}
            recordSchemas={expression.recordSchemas}
            drillRoots={expression.drillRoots}
            value={draft.condition}
            onChange={(v) => setDraft({ condition: v })}
            placeholder={'e.g. amount > 10000'}
          />
        ) : (
          <textarea className="ws-props-input ws-props-textarea" rows={2} value={draft.condition}
            onChange={(e) => setDraft({ condition: e.target.value })} placeholder="JSONata, e.g. amount > 10000" />
        )}
      </div>
    </div>
  );
}

export const ExitConditionsEditor: React.FC<ExitConditionsEditorProps> = ({
  lines, actions, stageNames = {}, disabled, expression, onAdd, onUpdate, onRemove,
}) => {
  // Clicking a line opens its config modal; every edit writes straight through
  // to the line — there is no Save step.
  const [editLine, setEditLine] = useState<WorkflowExitLine | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);

  const labels = Object.fromEntries(actions.map((a) => [a.value, a.label]));

  const openEdit = (line: WorkflowExitLine) => {
    setEditLine(line);
    setEditDraft({ label: line.label, action: line.action || '', votePolicy: line.votePolicy || 'at_least', voteCount: line.voteCount ?? 1, condition: line.expression || '' });
  };
  // + Add Exit creates the line immediately (no create form) and opens its
  // config for live editing.
  const startAdd = () => {
    const id = onAdd({ label: 'New Exit', action: undefined, votePolicy: 'at_least', voteCount: 1, expression: '' });
    if (id) openEdit({ id, label: 'New Exit', action: undefined, votePolicy: 'at_least', voteCount: 1, expression: '' });
  };
  const closeModal = () => {
    setEditLine(null);
    setEditDraft(null);
  };
  /** Each field change updates the line configuration immediately. */
  const applyDraft = (patch: Partial<Draft>) => {
    setEditDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if (editLine) {
        onUpdate(editLine.id, {
          label: next.label.trim() || 'New Exit',
          action: next.action || undefined,
          votePolicy: next.votePolicy,
          voteCount: next.votePolicy === 'at_least' ? next.voteCount : undefined,
          expression: next.condition.trim(),
        });
      }
      return next;
    });
  };

  return (
    <div className="ecl">
      <div className="ecl__head ws-props-section-title">
        <span className="ecl__head-title"><Link2 size={11} /> Exit Conditions</span>
        <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" disabled={disabled} onClick={startAdd} title="Add a new exit condition line">
          <Plus size={12} /> Add Exit
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="ws-props-hint" style={{ padding: '0 12px' }}>No outgoing lines — with a Task Approval event this stage stays open until its task is decided.</p>
      ) : (
        <div className="ecl__list">
          {lines.map((br) => {
            const isActive = editLine?.id === br.id;
            const target = br.targetType === 'completed' ? 'Completed' : stageNames[br.targetStageId || ''] || br.targetStageId || '?';
            return (
              <div
                key={br.id}
                className={`ws-event-chip ws-event-chip--list${isActive ? ' ws-event-chip--selected' : ''}`}
                style={{ borderColor: 'var(--sails-primary,#9dcee0)', color: 'var(--sails-primary,#9dcee0)', margin: '2px 0', width: '100%', justifyContent: 'space-between' }}
                title={`${exitConditionTooltip(br, labels)} — click to configure`}
                onClick={() => openEdit(br)}
                onDoubleClick={() => openEdit(br)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <Link2 size={12} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{exitConditionSummary(br, labels)}</span>
                  <span style={{ opacity: 0.7, fontWeight: 500 }}>→ {target}</span>
                </span>
                <button
                  type="button"
                  className="ws-icon-btn ws-icon-btn--danger"
                  title="Remove line"
                  disabled={disabled}
                  style={{ flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); onRemove(br.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="ws-props-hint" style={{ padding: '4px 12px 0' }}>
        Each line is an exit from this stage — the decision it follows (All / Any / At least N), with an optional JSONata gate. First match in order wins. Click a line to configure.
      </p>

      {editLine && editDraft && createPortal(
        <div className="ws-modal-overlay" style={{ zIndex: 80 }} onClick={closeModal}>
          <div className="ws-modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6' }}><Link2 size={16} /></span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">Line Properties</span>
                <span className="ws-modal__sub">Configure “{exitConditionSummary(lines.find((l) => l.id === editLine.id) || editLine, labels)}” — changes apply immediately</span>
              </div>
              <button className="ws-icon-btn" onClick={closeModal}><X size={15} /></button>
            </div>
            <div className="ws-modal__body">
              <LineEditor draft={editDraft} setDraft={applyDraft} actions={actions} expression={expression} />
            </div>
            <div className="ws-modal__footer">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ExitConditionsEditor;
