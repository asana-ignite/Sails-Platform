/**
 * VariableAutocomplete — the `{{` intellisense popup.
 *
 * Anchored near the caret; lists workflow variables (with drill-down: type
 * `record.` / `var.` / `invoices.0.` to descend, exactly like the picker
 * tree).  Arrow keys + Enter select, Escape dismisses.  Emits the formatted
 * reference via onPick.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import {
  topNodes, colNodes, iconOf, typeLabelOf, refFromSegs, resolveAutocompleteLevel, segsForPicked,
  type TreeNode, type PickerVariable, type PickerSchemaMap,
} from './variableTree';

interface Props {
  open: boolean;
  anchor: { left: number; top: number } | null;
  /** Everything typed after `{{` (e.g. "record.", "inv", "invoices.0."). */
  query: string;
  variables: PickerVariable[];
  recordSchemas: PickerSchemaMap;
  /** Emitted ref — always moustache form {{var.path}} for template fields. */
  onPick: (ref: string) => void;
  onClose: () => void;
}

export const VariableAutocomplete: React.FC<Props> = ({ open, anchor, query, variables, recordSchemas, onPick, onClose }) => {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const tree = useMemo(() => topNodes(variables, recordSchemas), [variables, recordSchemas]);
  const level = useMemo(() => resolveAutocompleteLevel(tree, query), [tree, query]);
  const items = useMemo(() => {
    const q = level.prefix.toLowerCase();
    return level.list.filter((n) => !q || n.label.toLowerCase().includes(q) || (n.kind === 'index' && 'n'.includes(q)));
  }, [level]);

  // Provisional position below the caret (clamped horizontally).
  useEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    setPos({ left: Math.max(8, Math.min(anchor.left, window.innerWidth - 316)), top: anchor.top + 4 });
  }, [open, anchor]);

  // Measure the real popup after mount and flip above / clamp to the viewport.
  useEffect(() => {
    if (!open || !pos || !popupRef.current) return;
    const el = popupRef.current;
    const r = el.getBoundingClientRect();
    let top = pos.top;
    let left = pos.left;
    if (r.bottom > window.innerHeight - 8) top = Math.max(8, pos.top - r.height - 12);
    if (r.right > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8);
    if (left < 8) left = 8;
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos]);

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' || e.key === 'Tab') {
        if (items[active]) {
          e.preventDefault();
          const ref = refFromSegs(segsForPicked(items[active], level.path, level.prefix), 'moustache');
          onPick(ref);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, items, active, level, onPick, onClose]);

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.querySelector('[data-active="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, open]);

  if (!open || !anchor || !pos) return null;

  return createPortal(
    <div
      ref={popupRef}
      className="wva-pop"
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: 300, zIndex: 95 }}
      onMouseDown={(e) => e.preventDefault()} // keep focus in the input
    >
      <div className="wva-pop__head">Variables</div>
      <div className="wva-pop__list" ref={listRef}>
        {items.length === 0 ? (
          <p className="wva-pop__empty">No variables match “{level.prefix}”</p>
        ) : items.map((n, i) => (
          <div
            key={n.key}
            className={`wva-pop__item ${i === active ? 'wva-pop__item--active' : ''}`}
            data-active={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={(e) => {
              e.preventDefault();
              const ref = refFromSegs(segsForPicked(n, level.path, level.prefix), 'moustache');
              onPick(ref);
              onClose();
            }}
          >
            <span className="wva-pop__icon">{iconOf(n.kind === 'index' ? 'number' : n.kind === 'collection' ? 'collection' : n.kind === 'record' ? 'record' : n.typeLabel)}</span>
            <span className="wva-pop__label">{n.kind === 'index' ? '[N]' : n.label}</span>
            {n.children && n.children.length > 0 && <ChevronRight size={11} className="wva-pop__drill" />}
            <span className="wva-pop__type">{n.typeLabel}</span>
          </div>
        ))}
      </div>
      <div className="wva-pop__hint">↑↓ navigate · Enter insert · type “record.” or “var.” to drill · Esc close</div>
    </div>,
    document.body,
  );
};

export default VariableAutocomplete;
