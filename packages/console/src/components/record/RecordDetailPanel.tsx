import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useRecordStack, type StackEntry } from '../../contexts/RecordStackContext';
import DynamicDetailPage from '../../pages/DynamicDetailPage';
import './RecordDetailPanel.css';

const DESKTOP_PEEK = 36;
const MOBILE_PEEK = 24;
const DESKTOP_MAX_VISIBLE = 4;
const MOBILE_MAX_VISIBLE = 3;
const DESKTOP_SHIFT = 45;
const MOBILE_SHIFT = 0;

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

interface StackCardProps {
  entry: StackEntry;
  isTop: boolean;
  zIndex: number;
  isClosing: boolean;
  /** How many px this card's right edge sits in from the panel's right edge
   *  (0 = bottom card at full width; the top card is the narrowest, so every
   *  card below peeks out to the right — visible stacked steps). */
  widthInset: number;
  onClose: () => void;
  onPopTo: (id: string) => void;
}

const StackCard: React.FC<StackCardProps> = ({ entry, isTop, zIndex, isClosing, widthInset, onClose, onPopTo }) => {
  // Entrance: start shifted right and transition to the stacked position.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Closing cards fly out to the right.
  const transform = isClosing || !entered ? 'translateX(140px)' : 'translateX(0)';

  return (
    <div
      className={`record-stack__card${isTop ? ' is-top' : ''}${isClosing ? ' is-closing' : ''}`}
      style={{ transform, zIndex, width: `calc(100% - ${widthInset}px)` }}
      onClick={isTop || isClosing ? undefined : () => onPopTo(entry.id)}
      title={isTop || isClosing ? undefined : 'Close cards above'}
    >
      <div className="record-stack__chrome">
        {isTop && !isClosing && (
          <button type="button" className="record-stack__close" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="record-stack__card-inner">
        <DynamicDetailPage
          key={entry.id}
          tableName={entry.tableName}
          layoutKey={entry.layoutKey}
          recordId={entry.recordId}
          presetValues={entry.preset}
          inStack
        />
      </div>
    </div>
  );
};

/**
 * Renders the stacked record detail cards anchored to the app's main content
 * area (below the topbar, right of the sidebar — mirrors .sails-main-content).
 * Each card slides in from the right; every card below the top is slightly
 * wider, so its edge peeks out to the right of the card above — a visible
 * stack. Clicking an exposed edge closes the cards above it; the top card
 * closes via the X (fly-out).
 */
export const RecordDetailPanel: React.FC = () => {
  const { stack, closingIds, requestClose } = useRecordStack();
  const [area, setArea] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Track the main content region so the cards overlay exactly where the
  // normal page renders (follows sidebar collapse/toggle, breakpoints, resizes).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.sails-main-content');
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setArea({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const container = el.closest('.sails-layout-wrapper__container');
    if (container) ro.observe(container);
    window.addEventListener('resize', update);
    const mq = window.matchMedia('(max-width: 767px)');
    mq.addEventListener('change', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      mq.removeEventListener('change', update);
    };
  }, []);

  const closingSet = useMemo(() => new Set(closingIds), [closingIds]);

  const isMobile = isMobileViewport();
  const peek = isMobile ? MOBILE_PEEK : DESKTOP_PEEK;
  const maxVisible = isMobile ? MOBILE_MAX_VISIBLE : DESKTOP_MAX_VISIBLE;
  // Slide the panel right so a strip of the underlying page stays visible;
  // full-width on mobile.
  const shift = isMobile ? MOBILE_SHIFT : DESKTOP_SHIFT;

  if (stack.length === 0 || !area) return null;

  const topIndex = stack.length - 1;

  return (
    <div
      className="record-stack"
      style={{ top: area.top, left: area.left + shift, width: Math.max(0, area.width - shift), height: area.height }}
    >
      {stack.map((entry, idx) => (
        <StackCard
          key={entry.id}
          entry={entry}
          isTop={idx === topIndex}
          zIndex={100 + idx}
          isClosing={closingSet.has(entry.id)}
          widthInset={Math.min(idx, maxVisible) * peek}
          onClose={() => requestClose()}
          onPopTo={requestClose}
        />
      ))}
    </div>
  );
};

export default RecordDetailPanel;
