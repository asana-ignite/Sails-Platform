/**
 * ScriptEventModal — modal configuration for a form-event Script (BYOC),
 * built on the shared EventModalShell.
 */
import React from 'react';
import { Workflow as WorkflowIcon } from 'lucide-react';
import type { FormEvent } from '@sails/shared';
import { CustomSelect } from '../../components/common/CustomSelect';
import { MOCK_SCRIPTS } from './index';
import { EventModalShell, useEventModalClose } from './EventModalShell';

interface Props {
  event: FormEvent;
  onPatch: (patch: Partial<FormEvent>) => void;
  onConfigChange: (name: string, value: any) => void;
  onDone: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const ScriptEventModal: React.FC<Props> = ({
  event, onPatch, onConfigChange, onDone, onRemove, onClose, 
}) => {
  const cancel = useEventModalClose(event, onPatch, onClose);
  const config = event.config || {};

  return (
    <EventModalShell
      icon={<WorkflowIcon size={15} />}
      accent="#8b5cf6"
      title="Script"
      subtitle="BYOC script (sandbox)"
      onClose={cancel}
      onDone={onDone}
      onRemove={onRemove}
      width={560}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="ls-prop-group">
          <label className="ls-prop-label">Label</label>
          <input className="sails-input" value={event.label || ''} onChange={(e) => onPatch({ label: e.target.value })} />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">BYOC Script</label>
          <CustomSelect
            size="md"
            value={config.scriptId || ''}
            options={[
              { label: '— select —', value: '' },
              ...MOCK_SCRIPTS.map((s) => ({ label: s.name, value: s.id })),
            ]}
            onChange={(v) => onConfigChange('scriptId', v)}
          />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">Timeout (ms)</label>
          <input
            className="sails-input"
            type="number"
            min={500}
            step={500}
            value={config.timeoutMs ?? 10000}
            onChange={(e) => onConfigChange('timeoutMs', Number(e.target.value))}
          />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">Store result as (variable)</label>
          <input
            className="sails-input"
            value={event.storeAs || ''}
            placeholder="myVar — optional"
            onChange={(e) => onPatch({ storeAs: e.target.value || undefined })}
          />
          <p className="ls-prop-hint">
            Downstream events reference via <code>variables.{event.storeAs || '…'}</code>.
          </p>
        </div>
      </div>
    </EventModalShell>
  );
};

export default ScriptEventModal;
