/**
 * AssignToEditor — the Task Approval "Assign To" picker.
 *
 * The assignee is a REFERENCE, resolved to the CURRENT holders at task time by
 * the approval plugin (so a role/team/position always targets whoever holds it
 * right now — a newly added Sales Manager gets the next task automatically).
 *
 * Modes (segmented):
 *   Team / Role / Position / User  — searchable live options (or exact ref)
 *   Record Field                   — a trigger-model column read at runtime
 *   Variable                       — a workflow variable read at runtime
 *   Expression                     — inline JSONata returning a router token
 *
 * Multi-assignee: "Add another assignee" pushes the current reference (as a
 * `type:value` token) into config.routerRefs; the task then goes to every
 * resolved holder. Dynamic modes author the single reference only.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, Users, Briefcase, Shield, Database, Variable as VariableIcon, Braces, Plus, X, Info } from 'lucide-react';
import { CustomSelect } from '../common/CustomSelect';
import { ExpressionEditor } from './ExpressionEditor';
import type { PickerColumn, PickerSchemaMap } from './WorkflowVariablePicker';
import type { DrillRoots } from './jsonataSuggest';
import './AssignToEditor.css';

type AssigneeMode = 'user' | 'team' | 'position' | 'role' | 'field' | 'variable' | 'expression';

export interface AssignToEditorVariable {
  id: string;
  name: string;
  fieldType: string;
  targetModel?: string;
  columns?: { fieldName: string; logicalType?: string; label?: string; targetModel?: string }[];
}

interface AssignToEditorProps {
  config: Record<string, any>;
  onConfigChange: (name: string, value: any) => void;
  variables: AssignToEditorVariable[];
  /** Triggering model columns — enables Record Field mode. */
  recordSchema?: PickerColumn[];
  /** Model tableName → columns — record drill-down in the expression editor. */
  recordSchemas?: PickerSchemaMap;
  /** Workflow-context drill roots (record / oldRecord / requestor). */
  drillRoots?: DrillRoots;
}

interface AssigneeOptions {
  roles: string[];
  teams: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}

/** Multi-assignee runs only over the static reference modes (the meaningful
 * "Sales Manager AND Finance Analyst" case); dynamic modes author one ref. */
const STATIC_MODES: AssigneeMode[] = ['user', 'team', 'position', 'role'];

const MODES: { mode: AssigneeMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { mode: 'team', label: 'Team', icon: <Users size={13} />, hint: 'Task goes to every current team member.' },
  { mode: 'role', label: 'Role', icon: <Shield size={13} />, hint: 'Resolved to active users with that role — newly added members get the next task.' },
  { mode: 'position', label: 'Position', icon: <Briefcase size={13} />, hint: 'Task goes to the current holder(s) of the position.' },
  { mode: 'user', label: 'User', icon: <User size={13} />, hint: 'A specific person.' },
  { mode: 'field', label: 'Record Field', icon: <Database size={13} />, hint: 'Read a field of the triggering record at task time (value should be a reference like role:manager).' },
  { mode: 'variable', label: 'Variable', icon: <VariableIcon size={13} />, hint: 'Read a workflow variable at task time (value should be a reference like team:legal or user:<email>).' },
  { mode: 'expression', label: 'Expression', icon: <Braces size={13} />, hint: 'JSONata — return a reference (role:director, user:<id>) or {type,value}.' },
];

// Module-level cache so the wizard doesn't refetch on every open.
let optionsCache: AssigneeOptions | null | undefined;

async function fetchAssigneeOptions(): Promise<AssigneeOptions | null> {
  if (optionsCache !== undefined) return optionsCache ?? null;
  try {
    const res = await fetch('/api/tenant/workflow-assignees');
    if (!res.ok) throw new Error(String(res.status));
    optionsCache = await res.json();
    return optionsCache ?? null;
  } catch {
    optionsCache = null;
    return null;
  }
}

const FIELD_LIKE_TYPES = new Set(['user', 'relation', 'lookup', 'email', 'phone', 'text', 'short_text', 'long_text']);
const VAR_LIKE_TYPES = new Set(['user', 'record', 'email', 'phone', 'text', 'short_text', 'long_text']);

export const AssignToEditor: React.FC<AssignToEditorProps> = ({
  config, onConfigChange, variables, recordSchema, recordSchemas, drillRoots,
}) => {
  const routerType = (config.routerType as string) || 'role';
  const routerValue = String(config.routerValue ?? '');
  const routerRefs = Array.isArray(config.routerRefs)
    ? config.routerRefs.map(String).filter(Boolean)
    : [];

  const mode: AssigneeMode = (['user', 'team', 'position', 'role', 'field', 'variable', 'expression'].includes(routerType)
    ? routerType
    : 'role') as AssigneeMode;

  const [options, setOptions] = useState<AssigneeOptions | null>(null);
  const [exactDraft, setExactDraft] = useState<string>('');
  const exactInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const o = await fetchAssigneeOptions();
      if (o) setOptions(o);
    })();
  }, []);

  const set = (patch: Record<string, any>) => {
    for (const [k, v] of Object.entries(patch)) onConfigChange(k, v);
  };

  const setMode = (m: AssigneeMode) => {
    // Keep the existing value only when it still makes sense; otherwise reset.
    set({ routerType: m, routerValue: '' });
    setExactDraft('');
  };

  const setValue = (v: string) => {
    set({ routerValue: v });
    setExactDraft('');
  };

  // ── Option lists per static mode ──
  const staticOptions = useMemo(() => {
    if (!options) return [];
    if (mode === 'role') return options.roles.map((r) => ({ value: r, label: r }));
    if (mode === 'team') return options.teams.map((t) => ({ value: t.id, label: t.name }));
    if (mode === 'position') return options.positions.map((p) => ({ value: p.id, label: p.name }));
    if (mode === 'user') return options.users.map((u) => ({ value: u.id, label: `${u.name}${u.email ? ` (${u.email})` : ''}` }));
    return [];
  }, [options, mode]);

  // A configured value not present in the live list (e.g. legacy `director`
  // role or a raw id) is kept as an "exact" reference.
  const valueInOptions = routerValue ? staticOptions.some((o) => o.label === routerValue || o.value === routerValue) : false;
  const showExact = routerValue && !valueInOptions;
  const exactFromConfig = showExact ? routerValue : exactDraft;

  const commitExact = () => {
    if (exactInputRef.current) setValue(exactInputRef.current.value);
  };

  // ── Field / variable options ──
  const fieldOptions = useMemo(
    () => (recordSchema || [])
      .filter((c) => FIELD_LIKE_TYPES.has((c.logicalType || 'text').toLowerCase()))
      .map((c) => ({ value: c.fieldName, label: `${c.label || c.fieldName} — ${c.logicalType || 'text'}` })),
    [recordSchema],
  );
  const varOptions = useMemo(
    () => variables
      .filter((v) => v.name && VAR_LIKE_TYPES.has((v.fieldType || 'text').toLowerCase()))
      .map((v) => ({ value: v.name, label: v.name })),
    [variables],
  );

  // ── Multi-assignee ──
  const multi = routerRefs.length > 0;
  const addAnother = () => {
    if (!routerValue.trim()) return;
    const token = routerValue.includes(':') ? routerValue.trim() : `${mode}:${routerValue.trim()}`;
    set({ routerRefs: [...routerRefs, token], routerValue: '' });
    setExactDraft('');
  };
  const removeRef = (token: string) => {
    set({ routerRefs: routerRefs.filter((r) => r !== token) });
  };

  // Expression editor payload (structural mapping of wizard variables).
  const suggestVariables = useMemo(
    () => variables.map((v) => ({
      id: v.id,
      name: v.name,
      fieldType: v.fieldType,
      targetModel: v.targetModel,
      columns: (v.columns || []).map((c) => ({
        fieldName: c.fieldName,
        label: c.label || c.fieldName,
        logicalType: c.logicalType || 'text',
        ...(c.targetModel ? { targetModel: c.targetModel } : {}),
      })),
    })),
    [variables],
  );

  const meta = MODES.find((m) => m.mode === mode);

  return (
    <div className="atr">
      {/* Segmented mode switcher */}
      <div className="atr__seg" role="group" aria-label="Assign to">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            title={m.hint}
            className={`atr__seg-opt${mode === m.mode ? ' is-active' : ''}`}
            onClick={() => setMode(m.mode)}
            disabled={multi && !STATIC_MODES.includes(m.mode)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <p className="atr__hint"><Info size={11} /> {meta?.hint}</p>

      {/* Static reference modes */}
      {STATIC_MODES.includes(mode) && (
        <div className="atr__body">
          <div className="atr__row">
            <CustomSelect
              size="md"
              searchable
              value={valueInOptions ? routerValue : ''}
              options={staticOptions}
              onChange={(v) => setValue(String(v))}
              placeholder={mode === 'user' ? 'Search people…' : `Search ${meta?.label.toLowerCase()}s…`}
            />
            {showExact && (
              <span className="atr__exact-chip" title={routerValue}>
                Exact: {routerValue}
                <button type="button" onClick={() => setValue('')}><X size={10} /></button>
              </span>
            )}
          </div>
          <div className="atr__exact-row">
            <input
              ref={exactInputRef}
              className="sails-input"
              placeholder={mode === 'user' ? 'or type an exact reference (id or user:email)' : 'or type an exact name / id / reference'}
              defaultValue={exactFromConfig}
              onKeyDown={(e) => { if (e.key === 'Enter') commitExact(); }}
              onBlur={commitExact}
            />
            <span className="atr__exact-note">Press Enter / blur to use</span>
          </div>
        </div>
      )}

      {/* Record Field */}
      {mode === 'field' && (
        <div className="atr__body">
          {fieldOptions.length === 0 ? (
            <p className="atr__empty">No person-like columns on the triggering model.</p>
          ) : (
            <CustomSelect
              size="md"
              searchable
              value={routerValue}
              options={fieldOptions}
              onChange={(v) => setValue(String(v))}
              placeholder="Select a record field…"
            />
          )}
          <p className="atr__note">The field is read at task time. Its value should be a reference — e.g. <code>role:manager</code>, <code>team:legal</code>, or a user id / email.</p>
        </div>
      )}

      {/* Variable */}
      {mode === 'variable' && (
        <div className="atr__body">
          {varOptions.length === 0 ? (
            <p className="atr__empty">No suitable workflow variables yet — add a user / record / text variable first.</p>
          ) : (
            <CustomSelect
              size="md"
              searchable
              value={routerValue}
              options={varOptions}
              onChange={(v) => setValue(String(v))}
              placeholder="Select a workflow variable…"
            />
          )}
          <p className="atr__note">The variable is read at task time. Its value should be a reference — e.g. <code>role:finance</code> or a user id.</p>
        </div>
      )}

      {/* Expression */}
      {mode === 'expression' && (
        <div className="atr__body">
          <ExpressionEditor
            compact
            variables={suggestVariables}
            recordSchemas={recordSchemas as any}
            drillRoots={drillRoots}
            value={routerValue}
            onChange={(v) => set({ routerValue: v })}
            placeholder={'e.g. $eval(\'role:\' & (amount > 50000 ? "director" : "manager"))'}
          />
        </div>
      )}

      {/* Multi-assignee */}
      {multi && (
        <div className="atr__multi">
          <span className="atr__multi-title">This task goes to every reference:</span>
          {routerRefs.map((r) => (
            <span key={r} className="atr__chip">
              {r}
              <button type="button" title="Remove" onClick={() => removeRef(r)}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      {STATIC_MODES.includes(mode) && !multi && routerValue.trim() && (
        <button type="button" className="atr__add sails-btn sails-btn--ghost sails-btn--sm" onClick={addAnother}>
          <Plus size={12} /> Assign to another (multi-assignee)
        </button>
      )}
      {multi && (
        <p className="atr__note">Multi-assignee uses static references (team / role / position / user). Edit each via the picker, then Add — or remove a chip above.</p>
      )}
    </div>
  );
};

export default AssignToEditor;
