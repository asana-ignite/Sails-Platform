/**
 * useDropdownPosition — viewport-aware popover positioning shared by all
 * flyovers (autocomplete, filter popovers, pickers): measures the panel,
 * flips up/down by available space, clamps to the viewport, and
 * re-positions on scroll/resize.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface DropdownPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number | 'auto';
  bottom?: number;
}

export interface UseDropdownPositionOptions {
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLElement>;
  panelRef: React.RefObject<HTMLElement>;
  direction?: 'up' | 'down' | 'auto';
  /** Horizontal anchoring relative to the trigger. */
  align?: 'left' | 'right';
  /** Fixed panel width; otherwise the panel matches the trigger width. */
  width?: number;
  /** When true (default) the panel width mirrors the trigger width; when false
   *  the panel's own natural width is measured instead. */
  matchTriggerWidth?: boolean;
  /** Vertical gap between the trigger and the panel. */
  gap?: number;
  /** Close the panel when the trigger scrolls fully out of view. */
  closeOnTriggerOut?: boolean;
  onClose?: () => void;
  /** Re-run positioning when these change (e.g. search query, options). */
  deps?: unknown[];
}

/**
 * Viewport-aware popover positioning shared across the platform.
 *
 * The panel is measured (natural height, before clamping), then placed on the
 * side that fits its content — down first, up when the space below is too
 * small, and the larger side when neither fits. The panel is clamped exactly
 * to the available space so it can never extend past the browser edge (and
 * therefore can never be clipped into an invisible sliver); long content
 * scrolls inside the panel instead.
 *
 * While open, the chosen direction is kept stable across scroll/resize
 * re-positions (no mid-open flipping) unless the kept side runs out of room.
 *
 * Notes for consumers:
 * - The panel must render inside a `position: fixed` viewport-size wrapper
 *   (usually via createPortal) so it can fly over overflow: hidden parents.
 * - Drop-up panels MUST use the returned `top: 'auto'` (and `bottom`) exactly
 *   as given: any other `top` value collides with the anchor `bottom` and
 *   collapses the box to zero height.
 */
export function useDropdownPosition({
  isOpen,
  triggerRef,
  panelRef,
  direction = 'auto',
  align = 'left',
  width,
  matchTriggerWidth = true,
  gap = 8,
  closeOnTriggerOut = true,
  onClose,
  deps = [],
}: UseDropdownPositionOptions) {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [dropUp, setDropUp] = useState(false);
  /** True when the panel was height-clamped to the viewport space (its natural
   *  content is taller than the room available). Consumers can use this to
   *  compact their content instead of scrolling. */
  const [isClamped, setIsClamped] = useState(false);
  /** Direction chosen while the panel is open — kept stable across re-positions. */
  const dropUpRef = useRef(false);
  /** True once position() has run for the current open session — the "keep the
   *  current direction" rule must only apply on re-positions, not on open. */
  const positionedRef = useRef(false);
  /** Measured natural height of the panel content (unclamped). */
  const naturalHeightRef = useRef<number | undefined>();
  /** Measured natural width of the panel (when matchTriggerWidth is false). */
  const panelWidthRef = useRef<number | undefined>();

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    // Measure the panel's natural size without clamping, then restore the
    // clamped style. Runs before paint, so there is no visual flash.
    const measureNatural = () => {
      const panel = panelRef.current;
      if (!panel) return naturalHeightRef.current;
      const prevMaxH = panel.style.maxHeight;
      panel.style.maxHeight = 'none';
      const h = panel.scrollHeight;
      panel.style.maxHeight = prevMaxH;
      naturalHeightRef.current = h;
      return h;
    };

    const measureWidth = () => {
      const panel = panelRef.current;
      if (!panel) return panelWidthRef.current;
      const w = panel.getBoundingClientRect().width;
      panelWidthRef.current = w;
      return w;
    };

    const position = () => {
      const trigger = triggerRef.current!;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap);
      const spaceAbove = Math.max(0, rect.top - gap);
      const naturalH = measureNatural() ?? 220;

      // Direction: explicit prop wins; while the panel is already open keep the
      // initial direction as long as the trigger still has room on that side;
      // otherwise pick the side that fits the content (or the larger side).
      let dropUp: boolean;
      if (direction === 'up') dropUp = true;
      else if (direction === 'down') dropUp = false;
      else if (positionedRef.current && (dropUpRef.current ? spaceAbove : spaceBelow) >= gap) {
        dropUp = dropUpRef.current;
      } else if (naturalH <= spaceBelow) {
        dropUp = false;
      } else if (naturalH <= spaceAbove) {
        dropUp = true;
      } else {
        dropUp = spaceBelow < spaceAbove;
      }
      dropUpRef.current = dropUp;
      positionedRef.current = true;
      setDropUp(dropUp);

      // Clamp exactly to the available space: the panel must never extend past
      // the viewport edge, so it is never cut off into an invisible sliver.
      // Long content scrolls inside the panel instead.
      const panelWidth = width ?? (matchTriggerWidth ? rect.width : measureWidth() ?? rect.width);
      const space = dropUp ? spaceAbove : spaceBelow;
      const maxH = Math.min(naturalH, space);
      setIsClamped(maxH < naturalH);
      const maxLeft = Math.max(0, window.innerWidth - panelWidth - gap);
      const left = align === 'right'
        ? Math.min(Math.max(0, rect.right - panelWidth), maxLeft)
        : Math.min(rect.left, maxLeft);
      setPosition(
        dropUp
          ? { left, width: panelWidth, maxHeight: maxH, top: 'auto', bottom: window.innerHeight - rect.top + 6 }
          : { left, width: panelWidth, maxHeight: maxH, top: rect.bottom + 4 }
      );
    };

    position();

    // Re-position on scroll/resize; close the panel once the trigger scrolls
    // fully out of view.
    const handleScroll = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      if (closeOnTriggerOut && (rect.bottom < 0 || rect.top > window.innerHeight)) {
        onClose?.();
        return;
      }
      position();
    };

    window.addEventListener('resize', position);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', handleScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, direction, ...deps]);

  // Reset the position hints when the panel closes so the next open starts
  // with a fresh space-aware decision.
  useEffect(() => {
    if (!isOpen) {
      dropUpRef.current = false;
      positionedRef.current = false;
      naturalHeightRef.current = undefined;
      panelWidthRef.current = undefined;
      setIsClamped(false);
    }
  }, [isOpen]);

  return { position, dropUp, isClamped };
}
