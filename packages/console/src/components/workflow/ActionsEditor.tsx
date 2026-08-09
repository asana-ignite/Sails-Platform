/**
 * ActionsEditor — the Task Approval "Actions" picker (Selection-field style).
 *
 * Author one action per line — "Approve", "Reject", "Request Changes"… — just
 * like the Selection field's options list. Each line becomes a WorkflowAction:
 *   label = the line text
 *   value = slugified routing value (label → approved / request_changes)
 * Use the quick-add chips for common actions, or click a preview chip to change
 * its color / icon. Branch conditions route on `value` (decision_<stage>).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Paintbrush } from 'lucide-react';
import { parseWorkflowActions, defaultActionStyle, type WorkflowAction } from '@sails/shared';
import { ICON_MAP } from './actionIcons';
import './ActionsEditor.css';

const PRESET_ACTIONS = ['Approve', 'Reject', 'Request Changes', 'Need More Info', 'Sent Back'];

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'];
const ICON_NAMES = ['CheckCircle2', 'XCircle', 'RefreshCw', 'Info', 'CornerUpLeft', 'Circle', 'ThumbsUp', 'ThumbsDown'];

const chipsText = (actions: WorkflowAction[]): string =>
  (actions || []).map((a) => a.label).join('\n');

const parse = (text: string): WorkflowAction[] => parseWorkflowActions(text);

interface ActionsEditorProps {
  value: WorkflowAction[];
  onChange: (actions: WorkflowAction[]) => void;
}

export const ActionsEditor: React.FC<ActionsEditorProps> = ({ value, onChange }) => {
  const [text, setText] = useState<string>(() => chipsText(value));
  const [openStyleFor, setOpenStyleFor] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const actions = useMemo(() => parse(text), [text]);

  const commit = (nextText: string) => {
    setText(nextText);
    // Preserve color/icon overrides for actions whose value didn't change.
    const byValue = new Map((value || []).map((a) => [a.value, a]));
    const next = parse(nextText).map((a) => {
      const prev = byValue.get(a.value);
      return prev && (prev.color || prev.icon) ? { ...a, color: prev.color, icon: prev.icon } : a;
    });
    onChange(next);
  };

  const appendChip = (label: string) => {
    if (actions.some((a) => a.label.toLowerCase() === label.toLowerCase())) return;
    commit(text ? text + '\n' + label : label);
  };

  const setStyle = (action: WorkflowAction, color: string, icon: string) => {
    onChange((value || []).map((a) => (a.value === action.value ? { ...a, color, icon } : a)));
    setOpenStyleFor(null);
  };

  const clearStyle = (action: WorkflowAction) => {
    onChange((value || []).map((a) => (a.value === action.value ? { ...a, color: undefined, icon: undefined } : a)));
    setOpenStyleFor(null);
  };

  return (
    <div className="axe">
      <div className="axe__chips">
        <span className="axe__chips-title">Add:</span>
        {PRESET_ACTIONS.map((label) => {
          const exists = actions.some((a) => a.label.toLowerCase() === label.toLowerCase());
          return (
            <button key={label} type="button" className="axe__chip-add" disabled={exists} onClick={() => appendChip(label)}>
              <Plus size={10} /> {label}
            </button>
          );
        })}
      </div>

      <textarea
        ref={textRef}
        className="sails-input axe__textarea"
        rows={5}
        placeholder={'Approve\nReject\nRequest Changes\nSent Back'}
        value={text}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); commit(text + '\n'); } }}
      />
      <p className="axe__hint">One action per line. The value (used for routing) is created from the label automatically.</p>

      {actions.length > 0 && (
        <div className="axe__preview">
          {actions.map((a) => {
            const defaultStyle = defaultActionStyle(a.value);
            const color = a.color || defaultStyle.color;
            const Icon = ICON_MAP[a.icon || defaultStyle.icon] || ICON_MAP.Circle;
              return (
                <span
                  key={a.value}
                  className="axe__action"
                  style={{ borderColor: color, color }}
                  title={`${a.label} — ${a.value} (click to style)`}
                  onClick={() => setOpenStyleFor(openStyleFor === a.value ? null : a.value)}
                >
                  <Icon size={11} />
                  {a.label}
                </span>
              );
          })}
        </div>
      )}

      {openStyleFor && (() => {
        const a = actions.find((x) => x.value === openStyleFor);
        if (!a) return null;
        const defaultStyle = defaultActionStyle(a.value);
        const color = a.color || defaultStyle.color;
        const icon = a.icon || defaultStyle.icon;
        return (
          <div className="axe__style" onClick={(e) => e.stopPropagation()}>
            <div className="axe__style-row">
              <span className="axe__style-label"><Paintbrush size={11} /> Color</span>
              {COLORS.map((c) => (
                <button
                  key={c} type="button"
                  className={`axe__swatch${color === c ? ' is-active' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setStyle(a, c, icon)}
                />
              ))}
            </div>
            <div className="axe__style-row">
              <span className="axe__style-label">Icon</span>
              {ICON_NAMES.map((n) => {
                const I = ICON_MAP[n];
                return (
                  <button
                    key={n} type="button"
                    className={`axe__icon-btn${icon === n ? ' is-active' : ''}`}
                    style={{ color }}
                    title={n}
                    onClick={() => setStyle(a, color, n)}
                  >
                    <I size={13} />
                  </button>
                );
              })}
            </div>
            {(a.color || a.icon) && (
              <button type="button" className="axe__reset" onClick={() => clearStyle(a)}>Reset to default</button>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ActionsEditor;
