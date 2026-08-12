/**
 * MOCKUP — JSONata expression modal for the workflow prototype.
 */
import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import ExpressionEditor from '../../../../components/workflow/ExpressionEditor';
import { EVENT_DEFS } from '../constants';
import { sampleValuesForVariables } from '../helpers';
import type { RouteStage, WorkflowEvent, WorkflowVariable } from '../types';

export interface ExpressionModalProps {
  event: WorkflowEvent;
  stage: RouteStage;
  variables: WorkflowVariable[];
  onUpdateConfig: (patch: Record<string, any>) => void;
  onClose: () => void;
}

/** Large modal JSONata editor for Expression / Transform events. */
export const ExpressionModal: React.FC<ExpressionModalProps> = ({
  event, stage, variables, onUpdateConfig, onClose,
}) => {
  const def = EVENT_DEFS.find((d) => d.type === event.type);
  const sample = sampleValuesForVariables(variables);

  return (
    <div className="rb2-modal-overlay" onClick={onClose}>
      <div className="rb2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rb2-modal__header">
          <span className="rb2-modal__icon" style={{ color: def?.color }}>{def?.icon}</span>
          <div className="rb2-modal__titles">
            <span className="rb2-modal__title">{def?.label} — {event.label}</span>
            <span className="rb2-modal__sub">Stage: {stage.name} · JSONata editor</span>
          </div>
          <button type="button" className="rb2-icon-btn" title="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="rb2-modal__body">
          <ExpressionEditor
            showSnippets
            variables={variables.map((v) => ({ id: v.id, name: v.name, fieldType: v.fieldType }))}
            value={event.config.expression || ''}
            onChange={(v) => onUpdateConfig({ expression: v })}
            sample={sample}
          />

          <p className="rb2-hint">
            JSONata is the platform expression language — used for branch conditions, the Expression
            event and the Transform event. Type <code>$</code> for function suggestions
            (<code>$sum, $uppercase, $split, $map…</code>) and use <strong>Test</strong> to evaluate
            against the sample record. Bind a result to a workflow variable with JSONata assignment:
            <code> $total := $sum(items)</code>.
          </p>
        </div>

        <div className="rb2-modal__footer">
          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={onClose}>
            <CheckCircle2 size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpressionModal;
