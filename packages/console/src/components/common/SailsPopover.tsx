/**
 * SailsPopover — positioned popover primitive used by menus and pickers.
 */
import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDropdownPosition, type UseDropdownPositionOptions } from '../../hooks/useDropdownPosition';

interface SailsPopoverProps extends Omit<UseDropdownPositionOptions, 'isOpen' | 'triggerRef' | 'panelRef'> {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * SailsPopover — portaled, viewport-aware popover shell.
 *
 * Escapes overflow: hidden parents, opens upward when there is not enough room
 * below, and clamps to the viewport. Position/width/max-height are applied
 * inline, overriding the content's own positioning CSS.
 *
 * Content sizes the popover naturally (`matchTriggerWidth: false` by default).
 */
export const SailsPopover: React.FC<SailsPopoverProps> = ({
  open,
  triggerRef,
  className = '',
  style,
  children,
  ...positionOpts
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { position } = useDropdownPosition({
    isOpen: open,
    triggerRef,
    panelRef,
    matchTriggerWidth: false,
    ...positionOpts,
  });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        ref={panelRef}
        className={className}
        style={position
          ? { position: 'absolute', pointerEvents: 'auto', ...position, ...style }
          : { visibility: 'hidden', position: 'absolute', ...style }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default SailsPopover;
