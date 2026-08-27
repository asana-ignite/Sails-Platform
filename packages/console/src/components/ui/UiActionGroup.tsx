/**
 * UiActionGroup & UiSplitButton — Modern Segmented Action Capsule and Split CTA Button
 * Supports unified toolbars, split-branch workflows, micro-loading states, and categorized dropdowns.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

/* ─── Segmented Action Group (Capsule) ────────────────────────── */

export interface UiActionItemProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'danger' | 'success' | 'success-fill' | 'danger-fill';
  variant?: 'neutral' | 'primary' | 'danger' | 'success' | 'ghost' | 'secondary' | string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const UiActionItem = React.forwardRef<HTMLButtonElement, UiActionItemProps>(
  (
    {
      icon,
      label,
      onClick,
      disabled = false,
      active = false,
      tone,
      variant,
      title,
      className = '',
      style,
    },
    ref
  ) => {
    const resolvedTone = tone || (
      variant === 'danger' ? 'danger' :
      variant === 'primary' ? 'primary' :
      variant === 'success' ? 'success' :
      'neutral'
    );
    return (
      <button
        ref={ref}
        type="button"
        className={`ui-action-item ui-action-item--${resolvedTone} ${active ? 'ui-action-item--active' : ''} ${className}`}
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={style}
      >
        {icon && <span className="ui-action-item__icon">{icon}</span>}
        {label && <span className="ui-action-item__label">{label}</span>}
      </button>
    );
  }
);
UiActionItem.displayName = 'UiActionItem';

export interface UiActionGroupProps {
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const UiActionGroup: React.FC<UiActionGroupProps> = ({
  children,
  size = 'md',
  className = '',
  style,
}) => {
  return (
    <div className={`ui-action-group ui-action-group--${size} ${className}`} style={style}>
      {children}
    </div>
  );
};

export const UiActionDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className="ui-action-divider" />
);

/* ─── Split Primary Action Button ─────────────────────────────── */

export interface UiSplitOption {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  danger?: boolean;
  onClick: () => void;
}

export interface UiSplitButtonProps {
  primaryLabel: React.ReactNode;
  primaryIcon?: React.ReactNode;
  onPrimaryClick: () => void;
  options?: UiSplitOption[];
  loading?: boolean;
  loadingText?: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

import { SailsPopover } from '../common/SailsPopover';

export const UiSplitButton: React.FC<UiSplitButtonProps> = ({
  primaryLabel,
  primaryIcon,
  onPrimaryClick,
  options = [],
  loading = false,
  loadingText = 'Saving...',
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasOptions = options && options.length > 0;

  return (
    <div
      ref={dropdownRef}
      className={`ui-split-btn-group ui-split-btn-group--${variant} ui-split-btn-group--${size} ${className}`}
      style={style}
    >
      {/* Primary Action Half */}
      <button
        type="button"
        className={`ui-split-btn ui-split-btn--main ui-split-btn--${variant}`}
        disabled={disabled || loading}
        onClick={onPrimaryClick}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="sails-spin me-1" />
            <span>{loadingText}</span>
          </>
        ) : (
          <>
            {primaryIcon && <span className="ui-split-btn__icon">{primaryIcon}</span>}
            <span>{primaryLabel}</span>
          </>
        )}
      </button>

      {/* Dropdown Chevron Half */}
      {hasOptions && (
        <button
          type="button"
          className={`ui-split-btn ui-split-btn--trigger ui-split-btn--${variant} ${isOpen ? 'ui-split-btn--open' : ''}`}
          disabled={disabled || loading}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          aria-label="More save options"
        >
          <ChevronDown size={14} className={`ui-split-chevron ${isOpen ? 'ui-split-chevron--open' : ''}`} />
        </button>
      )}

      {/* Portaled Viewport-Aware Dropdown Menu */}
      {hasOptions && (
        <SailsPopover
          open={isOpen}
          triggerRef={dropdownRef}
          onClose={() => setIsOpen(false)}
          align="right"
          className="ui-split-dropdown"
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`ui-split-dropdown__item ${opt.danger ? 'ui-split-dropdown__item--danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                opt.onClick();
              }}
            >
              {opt.icon && <span className="ui-split-dropdown__icon">{opt.icon}</span>}
              <div className="ui-split-dropdown__content">
                <span className="ui-split-dropdown__title">{opt.label}</span>
                {opt.description && (
                  <span className="ui-split-dropdown__desc">{opt.description}</span>
                )}
              </div>
            </button>
          ))}
        </SailsPopover>
      )}
    </div>
  );
};

export default UiActionGroup;
