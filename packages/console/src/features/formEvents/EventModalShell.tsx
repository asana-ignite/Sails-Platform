/**
 * EventModalShell — the single chrome every Form-Event configuration modal
 * shares, so all event editors look and behave identically:
 *
 *   - ls-modal-overlay + ws-modal (icon-badge header with title/subtitle/X,
 *     scrollable body, footer: Remove · Cancel · Done),
 *   - Esc and click-outside close via onClose,
 *   - Cancel/X restore the snapshot captured when the modal opened (see
 *     useEventModalClose) so abandoning an edit never mutates the event.
 */
import React, { useEffect, useRef } from 'react';
import { X, CheckCircle2, Trash2 } from 'lucide-react';
import type { FormEvent } from '@sails/shared';
import './EventModalShell.css';

interface EventModalShellProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Icon badge accent (hex) — matches the platform's ws-modal icon style. */
  accent?: string;
  onClose: () => void;
  onDone: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  busy?: boolean;
  width?: number;
  children: React.ReactNode;
}

export const EventModalShell: React.FC<EventModalShellProps> = ({
  icon, title, subtitle, accent = '#3b82f6', onClose, onDone, onRemove, removeLabel = 'Remove', busy = false, width, children,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div className="ls-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="ws-modal em-shell" onClick={(e) => e.stopPropagation()} style={{ zIndex: 1000, ...(width ? { width } : {}) }}>
        <div className="ws-modal__header">
          <span className="ws-modal__icon" style={{ background: `${accent}22`, color: accent }}>{icon}</span>
          <div className="ws-modal__titles">
            <span className="ws-modal__title">{title}</span>
            {subtitle && <span className="ws-modal__sub">{subtitle}</span>}
          </div>
          <button className="ws-icon-btn" onClick={onClose} disabled={busy}><X size={15} /></button>
        </div>
        <div className="ws-modal__body em-shell__body">{children}</div>
        <div className="ws-modal__footer">
          {onRemove && (
            <button className="sails-btn sails-btn--ghost sails-btn--sm em-shell__remove" onClick={onRemove} disabled={busy}>
              <Trash2 size={13} /> {removeLabel}
            </button>
          )}
          <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={onDone} disabled={busy}>
            <CheckCircle2 size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Close-with-restore for event modals: the config/label snapshot taken when
 * the modal opened is written back on Cancel/X, so abandoning an edit never
 * leaves half-applied changes (same behavior as the Record Event editor).
 */
export function useEventModalClose(
  event: FormEvent,
  onPatch: (patch: Partial<FormEvent>) => void,
  onClose: () => void,
): () => void {
  const originalRef = useRef({ config: event.config, label: event.label });
  return () => {
    onPatch({ config: originalRef.current.config, label: originalRef.current.label });
    onClose();
  };
}

export default EventModalShell;
