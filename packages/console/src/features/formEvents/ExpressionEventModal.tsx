/**
 * ExpressionEventModal — modal configuration for a form-event Expression
 * (JSONata computation), built on the shared EventModalShell. Reuses the full
 * ExpressionEditor (intellisense, snippets).
 */
import React from 'react';
import { Code } from 'lucide-react';
import type { FormEvent, FormVariable } from '@sails/shared';
import ExpressionEditor from '../../components/workflow/ExpressionEditor';
import { EventModalShell, useEventModalClose } from './EventModalShell';

interface Props {
  event: FormEvent;
  onPatch: (patch: Partial<FormEvent>) => void;
  onConfigChange: (name: string, value: any) => void;
  onDone: () => void;
  onRemove: () => void;
  onClose: () => void;
  recordSchemas?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  drillRoots?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  triggerModelName?: string;
  /** Declared layout variables — shown in the picker (json → collection). */
  variables?: FormVariable[];
  variablesLabel?: string;
  contextLabel?: string;
}

export const ExpressionEventModal: React.FC<Props> = ({
  event, onPatch, onConfigChange, onDone, onRemove, onClose,
  recordSchemas, drillRoots, triggerModelName, variables, variablesLabel, contextLabel,
}) => {
  const cancel = useEventModalClose(event, onPatch, onClose);
  const config = event.config || {};

  return (
    <EventModalShell
      icon={<Code size={15} />}
      accent="#a855f7"
      title="Expression"
      subtitle="JSONata computation against the record + prior events"
      onClose={cancel}
      onDone={onDone}
      onRemove={onRemove}
      width={720}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="ls-prop-group">
          <label className="ls-prop-label">Label</label>
          <input className="sails-input" value={event.label || ''} onChange={(e) => onPatch({ label: e.target.value })} />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">JSONata Expression</label>
          <ExpressionEditor
            variables={(variables || []).map((v) => ({
              id: v.name,
              name: v.name,
              fieldType: v.fieldType === 'json' ? 'collection' : v.fieldType,
              ...(v.fieldType === 'record' ? { targetModel: triggerModelName } : {}),
            }))}
            variablesLabel={variablesLabel || 'Layout Variables'}
            contextLabel={contextLabel}
            recordSchemas={recordSchemas}
            drillRoots={drillRoots}
            triggerModelName={triggerModelName}
            value={config.expression || ''}
            onChange={(v) => onConfigChange('expression', v)}
            placeholder="record.budget * 1.07"
          />
          <p className="ls-prop-hint">Available: <code>record</code> (current values), <code>variables</code> (prior events), <code>request_date</code>.</p>
        </div>
      </div>
    </EventModalShell>
  );
};

export default ExpressionEventModal;
