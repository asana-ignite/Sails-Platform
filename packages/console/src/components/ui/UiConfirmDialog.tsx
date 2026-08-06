import React from 'react';
import { createPortal } from 'react-dom';

export const UiConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  body: React.ReactNode;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, icon, body, error, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', loading, onConfirm, onCancel }) => {
  if (!open) return null;
  return createPortal(
    <div className="ui-modal-overlay" onClick={() => { if (!loading) onCancel(); }}>
      <div className="ui-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="ui-confirm__header">{icon}{title}</div>
        <div className="ui-confirm__body">
          {body}
          {error && <div className="ui-confirm__error">{error}</div>}
        </div>
        <div className="ui-confirm__footer">
          <button className="sails-btn sails-btn--ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button
            className={`sails-btn ${tone === 'danger' ? 'sails-btn--danger' : 'sails-btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default UiConfirmDialog;
