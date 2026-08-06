import React from 'react';
import { MoreHorizontal } from 'lucide-react';

/** ⋮ action menu — one trigger button + flyout context menu. */
export const UiActionsMenu: React.FC<{
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ open, onToggle, children }) => (
  <div className="ui-actions-menu">
    <button
      className={`sails-btn sails-btn--ghost ${open ? 'active' : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title="Options"
      aria-label="Options"
    >
      <MoreHorizontal size={18} />
    </button>
    {open && (
      <div className="ui-context-menu" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    )}
  </div>
);

export const UiActionsItem: React.FC<{
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}> = ({ danger, disabled, onClick, children }) => (
  <button className={`ui-context-item ${danger ? 'ui-context-item--danger' : ''}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

export const UiActionsDivider: React.FC = () => <div className="ui-context-divider" />;

export default UiActionsMenu;
