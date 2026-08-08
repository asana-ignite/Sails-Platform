/**
 * VariableTextInput — variable-aware text control (TextBox / TextArea).
 *
 * Plain text with inline variable chips: `Please verify {{num}} for Approval`
 * renders as text with a chip in the middle.  Users type normally, get `{{`
 * intellisense (with record/collection drill-down), can open the hierarchy
 * picker (… button — TextBox: right end, TextArea: top-right), drag refs in,
 * and use ƒ to formulate a JSONata expression (`{{$expr}}` evaluated at
 * runtime by renderTemplate).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WorkflowVariablePicker, type PickerColumn } from './WorkflowVariablePicker';
import { VariableAutocomplete } from './VariableAutocomplete';
import { escapeHtml, refFromSegs, type PickerVariable, type PickerSchemaMap } from './variableTree';

interface Props {
  value: string;
  onChange: (v: string) => void;
  variables: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  /** Triggering record schema — enables `record.<field>` in the picker/ƒ editors. */
  recordSchema?: PickerColumn[];
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  includeOldRecord?: boolean;
  includeRequestor?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

const REF_RE = /(\{\{[^{}]+\}\})/g;

function serialize(el: HTMLElement): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent || '';
    else if (node instanceof HTMLElement && node.dataset.ref) out += node.dataset.ref;
    else out += (node as HTMLElement).textContent || '';
  }
  return out;
}

function renderHtml(value: string, multiline: boolean): string {
  const parts = value.split(REF_RE);
  return parts.map((p) => {
    if (/^\{\{[^{}]+\}\}$/.test(p)) {
      return `<span class="wve-chip" contenteditable="false" data-ref="${p}">${escapeHtml(p)}</span>`;
    }
    if (!p) return '';
    const escaped = escapeHtml(p);
    return multiline ? escaped.replace(/\n/g, '<br>') : escaped;
  }).join('');
}

export const VariableTextInput: React.FC<Props> = ({
  value, onChange, variables, recordSchemas = {}, recordSchema,
  triggerModelFields, triggerModelName, includeOldRecord, includeRequestor,
  multiline = false, rows = 3, placeholder = '', disabled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSerializedRef = useRef<string>(value);
  const [auto, setAuto] = useState<{ anchor: { left: number; top: number }; query: string } | null>(null);
  const autoRef = useRef<{ deleteStart: number; deleteNode: Node } | null>(null);
  const closeAuto = useCallback(() => setAuto(null), []);

  // Sync the DOM from props only when the serialized text differs (no caret jumps while typing).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (serialize(el) === value) return;
    el.innerHTML = renderHtml(value, multiline);
    lastSerializedRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const text = serialize(el);
    lastSerializedRef.current = text;
    if (text !== value) onChange(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onChange]);

  /** Detect a `{{` before the caret → open the autocomplete. */
  const checkAutocomplete = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setAuto(null); return; }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) { setAuto(null); return; }
    const before = (node.textContent || '').slice(0, range.startOffset);
    const m = before.match(/\{\{([^{}]*)$/);
    if (!m) { setAuto(null); return; }
    const caretRange = range.cloneRange();
    caretRange.collapse(true);
    const rect = caretRange.getBoundingClientRect();
    autoRef.current = { deleteStart: range.startOffset - m[0].length, deleteNode: node };
    setAuto({ anchor: { left: rect.left, top: rect.bottom }, query: m[1] });
  }, []);

  const insertRef = useCallback((ref: string) => {
    const el = containerRef.current;
    if (!el) return;
    const chip = `<span class="wve-chip" contenteditable="false" data-ref="${ref}">${escapeHtml(ref)}</span>&#8203;`;
    // If the autocomplete is open, select from `{{` to the caret so the typed
    // query is REPLACED by the chip (not inserted in front of it).
    const sel = window.getSelection();
    if (autoRef.current && sel && sel.rangeCount > 0) {
      try {
        const range = sel.getRangeAt(0);
        range.setStart(autoRef.current.deleteNode, autoRef.current.deleteStart);
        // Range end stays at the caret → selection covers `{{query`.
        sel.removeAllRanges();
        sel.addRange(range);
      } catch { /* node may be detached */ }
    }
    document.execCommand('insertHTML', false, chip);
    autoRef.current = null;
    setAuto(null);
    commit();
  }, [commit]);

  const handleInput = () => {
    commit();
    checkAutocomplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return;
      const node = range.startContainer;
      const chip = e.key === 'Backspace'
        ? (node.nodeType === Node.TEXT_NODE && range.startOffset === 0 ? node.previousSibling : null)
        : (node.nodeType === Node.TEXT_NODE && range.startOffset === (node.textContent || '').length ? node.nextSibling : null);
      if (chip instanceof HTMLElement && chip.classList.contains('wve-chip')) {
        e.preventDefault();
        chip.remove();
        commit();
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    let ref = e.dataTransfer.getData('text/plain');
    if (!ref) {
      try { ref = JSON.parse(e.dataTransfer.getData('application/json'))?.ref || ''; } catch { /* ignore */ }
    }
    if (!ref) return;
    const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (range && containerRef.current?.contains(range.startContainer)) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    }
    insertRef(ref);
  };

  const pickerOnExpression = (expr: string) => insertRef(`{{$${expr}}}`);

  return (
    <div className={`wve ${multiline ? 'wve--area' : 'wve--box'}`} style={{ position: 'relative' }}>
      {multiline ? (
        <div className="wve__area-wrap">
          <div
            ref={containerRef}
            className="wve-input wve-input--area"
            contentEditable={!disabled}
            suppressContentEditableWarning
            data-placeholder={placeholder}
            style={{ minHeight: rows * 20 }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onBlur={() => { setAuto(null); commit(); }}
            onFocus={checkAutocomplete}
          />
          {!disabled && (
            <div className="wve__corner">
              <WorkflowVariablePicker
                variables={variables}
                recordSchemas={recordSchemas}
                recordSchema={recordSchema}
                triggerModelFields={triggerModelFields}
                triggerModelName={triggerModelName}
                includeOldRecord={includeOldRecord}
                includeRequestor={includeRequestor}
                value=""
                variant="trigger"
                onChange={insertRef}
                onExpression={pickerOnExpression}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="wve__box-row">
          <div
            ref={containerRef}
            className="wve-input wve-input--box"
            contentEditable={!disabled}
            suppressContentEditableWarning
            data-placeholder={placeholder}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onBlur={() => { setAuto(null); commit(); }}
            onFocus={checkAutocomplete}
          />
          {!disabled && (
            <WorkflowVariablePicker
              variables={variables}
              recordSchemas={recordSchemas}
              recordSchema={recordSchema}
              triggerModelFields={triggerModelFields}
              triggerModelName={triggerModelName}
              includeOldRecord={includeOldRecord}
              includeRequestor={includeRequestor}
              value=""
              variant="trigger"
              onChange={insertRef}
              onExpression={pickerOnExpression}
            />
          )}
        </div>
      )}

      <VariableAutocomplete
        open={!!auto}
        anchor={auto?.anchor || null}
        query={auto?.query || ''}
        variables={variables}
        recordSchemas={recordSchemas}
        onPick={insertRef}
        onClose={closeAuto}
      />
    </div>
  );
};

export default VariableTextInput;
