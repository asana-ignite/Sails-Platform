/**
 * NotificationMessageModal — the runtime modal for a form-event
 * "Notification Message" event.
 *
 * Rendered by DynamicDetailPage when the form-event chain pauses. The modal
 * shows the server-rendered box (severity icon/color, title, message) and
 * one of:
 *   - Confirmation mode: Confirm / Cancel buttons (custom labels).
 *   - Notification mode: a single OK button.
 * The user's choice is posted back as a resume — confirm/ok continues the
 * chain, cancel stops the remaining events.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { NOTIFICATION_TYPES } from '../../features/formEvents';

export interface NotificationMessagePayload {
  mode: 'confirm' | 'notification';
  notificationType: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  okLabel: string;
}

interface Props {
  box: NotificationMessagePayload;
  busy?: boolean;
  onResolve: (choice: 'confirm' | 'cancel' | 'ok') => void;
  onDismiss?: () => void;
  /** Inline (non-portaled) rendering — used inside design-time previews. */
  inline?: boolean;
}

export const NotificationMessageModal: React.FC<Props> = ({ box, busy = false, onResolve, onDismiss, inline = false }) => {
  const def = NOTIFICATION_TYPES[box.notificationType] || NOTIFICATION_TYPES.information;
  const Icon = def.Icon;
  const isConfirm = box.mode === 'confirm';

  const boxEl = (
    <div
      className="nm-modal"
      role="alertdialog"
      aria-modal="true"
      aria-label={box.title}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="nm-modal__body">
        <div className="nm-modal__icon" style={{ color: def.color, background: `${def.color}1a` }}>
          <Icon size={26} />
        </div>
        <div className="nm-modal__content">
          <h3 className="nm-modal__title">{box.title}</h3>
          {box.message ? (
            <p className="nm-modal__message" style={{ whiteSpace: 'pre-wrap' }}>{box.message}</p>
          ) : null}
        </div>
      </div>
      <div className="nm-modal__footer">
        {isConfirm && (
          <button
            type="button"
            className="sails-btn sails-btn--ghost sails-btn--md"
            disabled={busy}
            onClick={() => onResolve('cancel')}
          >
            {box.cancelLabel || 'Cancel'}
          </button>
        )}
        <button
          type="button"
          className="sails-btn sails-btn--primary sails-btn--md"
          disabled={busy}
          autoFocus
          onClick={() => onResolve(isConfirm ? 'confirm' : 'ok')}
        >
          {busy ? <Loader2 size={15} className="ls-spin" /> : null}
          {isConfirm ? (box.confirmLabel || 'Confirm') : (box.okLabel || 'OK')}
        </button>
      </div>
    </div>
  );

  if (inline) return boxEl;

  return createPortal(
    <div className="nm-modal-overlay" onClick={() => !busy && onDismiss && onDismiss()}>
      {boxEl}
    </div>,
    document.body,
  );
};

export default NotificationMessageModal;
