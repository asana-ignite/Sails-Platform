/**
 * RecipientsChipsInput — email-style recipient entry for the Notification
 * event.  Recipients render as removable chips; type a token (email,
 * user:xxx, team:yyy, {{var.path}}) and press Enter, use the … button to pick
 * a variable reference, or the ƒ Expression… button to formulate a JSONata
 * expression whose evaluated result becomes the recipient(s) at runtime.
 *
 * Stored as an array of tokens: strings (emails / user:xx / {{var.path}}) and
 * { __expr: "<jsonata>" } objects.  Legacy comma-separated strings are still
 * accepted (split on read).
 */
import React, { useRef, useState } from 'react';
import { X, FunctionSquare } from 'lucide-react';
import { WorkflowVariablePicker, type PickerVariable, type PickerSchemaMap, type PickerColumn } from './WorkflowVariablePicker';

export type RecipientToken = string | { __expr: string };

interface Props {
  value: string | RecipientToken[];
  onChange: (v: RecipientToken[]) => void;
  variables: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  /** Triggering record schema — enables `record.<field>` intellisense in the ƒ editor. */
  recordSchema?: PickerColumn[];
  /** Workflow-context branches (record / oldRecord / requestor) for the picker. */
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  includeOldRecord?: boolean;
  includeRequestor?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function parseTokens(value: string | RecipientToken[]): RecipientToken[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
}

function tokenKey(t: RecipientToken): string {
  return typeof t === 'string' ? t : `__expr:${t.__expr}`;
}

export const RecipientsChipsInput: React.FC<Props> = ({ value, onChange, variables, recordSchemas, recordSchema, triggerModelFields, triggerModelName, includeOldRecord, includeRequestor, disabled, placeholder }) => {
  const chips = parseTokens(value);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addToken = (token: RecipientToken) => {
    const key = tokenKey(token);
    if (!key) return;
    if (chips.some((c) => tokenKey(c) === key)) { setDraft(''); return; }
    onChange([...chips, token]);
    setDraft('');
  };

  const removeChip = (idx: number) => {
    onChange(chips.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addToken(draft);
      return;
    }
    if (e.key === 'Backspace' && !draft && chips.length > 0) {
      removeChip(chips.length - 1);
    }
    if (e.key === 'Escape') {
      setDraft('');
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let ref = e.dataTransfer.getData('text/plain');
    if (!ref) {
      try {
        const p = JSON.parse(e.dataTransfer.getData('application/json'));
        ref = p?.ref || '';
      } catch { /* ignore */ }
    }
    if (ref) addToken(ref);
  };

  return (
    <div
      className="sails-searchlist"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="sails-searchlist__chips">
        {chips.map((c, i) => {
          const isExpr = typeof c === 'object' && !!c.__expr;
          const label = isExpr ? (c as { __expr: string }).__expr : (c as string);
          return (
            <span key={`${tokenKey(c)}-${i}`} className="sails-email-chip" title={label}>
              {isExpr && <FunctionSquare size={10} style={{ color: '#a855f7', flexShrink: 0 }} />}
              <span className="sails-searchlist__chip-label">{label}</span>
              <button
                type="button"
                className="sails-email-chip__remove"
                title="Remove recipient"
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); removeChip(i); }}
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
        {chips.length === 0 && (
          <span className="sails-searchlist__placeholder">{placeholder || 'Type a recipient or {{variable}}…'}</span>
        )}
        <input
          ref={inputRef}
          className="wrc-input__field"
          value={draft}
          placeholder=""
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (draft.trim()) addToken(draft); }}
          disabled={disabled}
        />
      </div>
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
        onChange={(ref) => addToken(ref)}
        onExpression={(expr) => addToken({ __expr: expr })}
        disabled={disabled}
      />
    </div>
  );
};

export default RecipientsChipsInput;
