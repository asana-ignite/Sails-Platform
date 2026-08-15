/**
 * NotificationMessageEventModal — modal configuration for a form-event
 * "Notification Message" event (Confirmation / Notification modes), built on
 * the shared EventModalShell with a LIVE preview of the runtime modal.
 */
import React from 'react';
import { MessageSquare } from 'lucide-react';
import type { FormEvent } from '@sails/shared';
import { CustomSelect } from '../../components/common/CustomSelect';
import TranslatableInput from '../../components/common/TranslatableInput';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_ORDER } from './index';
import { NotificationMessageModal } from '../../components/common/NotificationMessageModal';
import { EventModalShell, useEventModalClose } from './EventModalShell';

interface Props {
  event: FormEvent;
  onPatch: (patch: Partial<FormEvent>) => void;
  onConfigChange: (name: string, value: any) => void;
  onDone: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export const NotificationMessageEventModal: React.FC<Props> = ({
  event, onPatch, onConfigChange, onDone, onRemove, onClose,
}) => {
  const config = event.config || {};
  const mode = config.mode === 'notification' ? 'notification' : 'confirm';
  const cancel = useEventModalClose(event, onPatch, onClose);

  const previewBox: any = {
    mode,
    notificationType: NOTIFICATION_TYPES[config.notificationType] ? config.notificationType : 'information',
    title: config.title || event.label || 'Notification',
    message: config.message || '',
    confirmLabel: config.confirmLabel || 'Confirm',
    cancelLabel: config.cancelLabel || 'Cancel',
    okLabel: config.okLabel || 'OK',
  };

  return (
    <EventModalShell
      icon={<MessageSquare size={15} />}
      accent="#0ea5e9"
      title="Notification Message"
      subtitle="Modal shown to the user while the form-event chain runs"
      onClose={cancel}
      onDone={onDone}
      onRemove={onRemove}
      width={760}
    >
      <div style={{ display: 'flex', gap: 18 }}>
        {/* ── Config form ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Label</label>
            <input className="sails-input" value={event.label || ''} onChange={(e) => onPatch({ label: e.target.value })} />
          </div>

          <div className="ls-prop-group">
            <label className="ls-prop-label">Mode</label>
            <CustomSelect
              size="md"
              value={mode}
              options={[
                { label: 'Confirmation (Confirm / Cancel)', value: 'confirm' },
                { label: 'Notification (OK)', value: 'notification' },
              ]}
              onChange={(v) => onConfigChange('mode', v)}
            />
          </div>

          <div className="ls-prop-group">
            <label className="ls-prop-label">Notification Type</label>
            <CustomSelect
              size="md"
              value={previewBox.notificationType}
              options={NOTIFICATION_TYPE_ORDER.map((t) => {
                const def = NOTIFICATION_TYPES[t];
                return {
                  label: def.label,
                  value: t,
                  icon: <def.Icon size={12} style={{ color: def.color }} />,
                };
              })}
              onChange={(v) => onConfigChange('notificationType', v)}
            />
          </div>

          <div className="ls-prop-group">
            <label className="ls-prop-label">Title</label>
            <TranslatableInput
              value={config.title || ''}
              onChange={(v) => onConfigChange('title', v)}
              placeholder="e.g. Confirm submission?"
            />
          </div>

          <div className="ls-prop-group">
            <label className="ls-prop-label">Message</label>
            <textarea
              className="sails-input"
              rows={5}
              style={{ resize: 'vertical' }}
              value={config.message || ''}
              placeholder={'Are you sure you want to submit {{record.amount}}?'}
              onChange={(e) => onConfigChange('message', e.target.value)}
            />
            <p className="ls-prop-hint">
              Tokens <code>{'{{record.field}}'}</code> / <code>{'{{variables.name}}'}</code> are evaluated at run time.
              {mode === 'confirm' && ' Cancel stops the events below; events above already ran.'}
            </p>
          </div>

          {mode === 'confirm' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="ls-prop-group" style={{ flex: 1 }}>
                <label className="ls-prop-label">Confirm Button Label</label>
                <TranslatableInput value={config.confirmLabel || 'Confirm'} onChange={(v) => onConfigChange('confirmLabel', v)} />
              </div>
              <div className="ls-prop-group" style={{ flex: 1 }}>
                <label className="ls-prop-label">Cancel Button Label</label>
                <TranslatableInput value={config.cancelLabel || 'Cancel'} onChange={(v) => onConfigChange('cancelLabel', v)} />
              </div>
            </div>
          ) : (
            <div className="ls-prop-group">
              <label className="ls-prop-label">OK Button Label</label>
              <TranslatableInput value={config.okLabel || 'OK'} onChange={(v) => onConfigChange('okLabel', v)} />
            </div>
          )}
        </div>

        {/* ── Live preview ── */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <label className="ls-prop-label" style={{ display: 'block', marginBottom: 8 }}>Preview</label>
          <div className="nm-preview-stage">
            <NotificationMessageModal
              inline
              box={previewBox}
              onResolve={() => undefined}
            />
          </div>
        </div>
      </div>
    </EventModalShell>
  );
};

export default NotificationMessageEventModal;
