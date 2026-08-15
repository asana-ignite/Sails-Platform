/**
 * NotificationEventModal — modal configuration for a form-event Notification
 * (Email / Slack), built on the shared EventModalShell.
 */
import React from 'react';
import { Bell } from 'lucide-react';
import type { FormEvent } from '@sails/shared';
import { CustomSelect } from '../../components/common/CustomSelect';
import { MOCK_TEMPLATES } from './index';
import { EventModalShell, useEventModalClose } from './EventModalShell';

interface Props {
  event: FormEvent;
  onPatch: (patch: Partial<FormEvent>) => void;
  onConfigChange: (name: string, value: any) => void;
  onDone: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const NotificationEventModal: React.FC<Props> = ({
  event, onPatch, onConfigChange, onDone, onRemove, onClose, 
}) => {
  const cancel = useEventModalClose(event, onPatch, onClose);
  const config = event.config || {};

  return (
    <EventModalShell
      icon={<Bell size={15} />}
      accent="#f59e0b"
      title="Notification"
      subtitle="Email / Slack"
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
          <label className="ls-prop-label">Template</label>
          <CustomSelect
            size="md"
            value={config.templateId || ''}
            options={[
              { label: '— template —', value: '' },
              ...MOCK_TEMPLATES.map((t) => ({ label: t.name, value: t.id })),
            ]}
            onChange={(v) => onConfigChange('templateId', v)}
          />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">Channel</label>
          <CustomSelect
            size="md"
            value={config.channel || 'email'}
            options={[
              { label: 'Email', value: 'email' },
              { label: 'Slack', value: 'slack' },
              { label: 'Email + Slack', value: 'both' },
            ]}
            onChange={(v) => onConfigChange('channel', v)}
          />
        </div>

        <div className="ls-prop-group">
          <label className="ls-prop-label">Recipients</label>
          <input
            className="sails-input"
            value={config.to || ''}
            placeholder="{{record.email}}, manager@sails.app"
            onChange={(e) => onConfigChange('to', e.target.value)}
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

export default NotificationEventModal;
