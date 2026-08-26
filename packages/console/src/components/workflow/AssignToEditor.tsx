/**
 * AssignToEditor — the Task Approval "Assign To" picker.
 *
 * The assignee is a REFERENCE, resolved to the CURRENT holders at task time by
 * the approval plugin (so a role/team/position always targets whoever holds it
 * right now — a newly added Sales Manager gets the next task automatically).
 *
 * Modes (segmented):
 *   User / Position / Team — searchable live options; ALL accept multiple
 *                            selections (each pick adds a chip). Team fans
 *                            out to every member.
 *   Variable               — a workflow variable read at runtime, with a
 *                            "holds" selector declaring its reference kind
 *                            (user / team / position)
 *
 * Assignee Conditions: an ordered list of { condition → assignees } rules.
 * At task time rules are evaluated top-to-bottom; the FIRST matching rule's
 * assignees get the task. The default section below the rules is the
 * fallback — used when no rule matches (or when there are no rules).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { User, Users, Briefcase, Variable as VariableIcon, X, Info, Plus, Filter, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { CustomSelect } from '../common/CustomSelect';
import { VariableTextInput } from './VariableTextInput';
import type { PickerColumn, PickerSchemaMap } from './WorkflowVariablePicker';
import './AssignToEditor.css';

type AssigneeMode = 'user' | 'role' | 'team' | 'position' | 'variable';

export interface AssignToEditorVariable {
  id: string;
  name: string;
  fieldType: string;
  targetModel?: string;
  columns?: { fieldName: string; logicalType?: string; label?: string; targetModel?: string }[];
}

/** The assignee selection shape — used by the default picker AND each rule. */
export interface AssigneeValue {
  routerType: string;
  routerValue?: string;
  routerRefs?: string[];
  routerValueType?: string;
}

/** One conditional assignee rule: when conditionGroups match → these assignees. */
export interface AssigneeRule extends AssigneeValue {
  id: string;
  conditionGroups?: any[];
}

interface AssignToEditorProps {
  config: Record<string, any>;
  onConfigChange: (name: string, value: any) => void;
  variables: AssignToEditorVariable[];
  /** Triggering model columns — record drill-down in the variable editor. */
  recordSchema?: PickerColumn[];
  /** Model tableName → columns — record drill-down in the variable editor. */
  recordSchemas?: PickerSchemaMap;
  /** Opens the QueryStudio condition builder for a rule (wired by the studio). */
  onOpenAssigneeRuleCondition?: (ruleId: string) => void;
}

interface AssigneeOptions {
  roles?: string[];
  teams: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}

const STATIC_MODES: AssigneeMode[] = ['user', 'role', 'team', 'position'];

const MODES: { mode: AssigneeMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { mode: 'role', label: 'Role', icon: <Users size={13} />, hint: 'Task goes to every active user with this role (e.g. Tenant Admin) — pick multiple roles.' },
  { mode: 'team', label: 'Team', icon: <Users size={13} />, hint: 'Task goes to every current team member — pick multiple teams.' },
  { mode: 'position', label: 'Position', icon: <Briefcase size={13} />, hint: 'Task goes to the current holder(s) of the position — pick multiple positions.' },
  { mode: 'user', label: 'User', icon: <User size={13} />, hint: 'A specific person — pick multiple users at once.' },
  { mode: 'variable', label: 'Variable', icon: <VariableIcon size={13} />, hint: 'Read a workflow variable at task time — declare what its value holds (user / team / position).' },
];

async function fetchAssigneeOptions(): Promise<AssigneeOptions | null> {
  try {
    const res = await fetch('/api/tenant/workflow-assignees');
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    optionsCache = json;
    return json;
  } catch {
    return optionsCache ?? null;
  }
}

const VAR_LIKE_TYPES = new Set(['user', 'record', 'email', 'phone', 'text', 'short_text', 'long_text']);

let _ruleSeq = 0;
function genRuleId(): string {
  _ruleSeq++;
  return `ar_${Date.now().toString(36)}_${_ruleSeq}`;
}

/** The condition summary shown on a rule's chip. */
export function assigneeRuleConditionSummary(rule: AssigneeRule): string {
  const n = (rule.conditionGroups || []).reduce((acc: number, g: any) => acc + ((g?.rules || []).length || 0), 0);
  return n > 0 ? `Condition · ${n} rule${n > 1 ? 's' : ''}` : 'No condition — inactive';
}

/**
 * The assignee picker body, bound to a value object instead of the top-level
 * config — shared by the default (fallback) section and every rule.
 */
const AssigneeField: React.FC<{
  value: AssigneeValue;
  onChange: (patch: Record<string, any>) => void;
  variables: AssignToEditorVariable[];
  recordSchema?: PickerColumn[];
  recordSchemas?: PickerSchemaMap;
}> = ({ value, onChange, variables, recordSchema, recordSchemas }) => {
  const routerType = (value.routerType as string) || 'team';
  const routerValue = String(value.routerValue ?? '');
  const routerValueType = (value.routerValueType as string) || 'user';
  const routerRefs = Array.isArray(value.routerRefs)
    ? value.routerRefs.map(String).filter(Boolean)
    : [];

  const mode: AssigneeMode = (['user', 'role', 'team', 'position', 'variable'].includes(routerType)
    ? routerType
    : 'team') as AssigneeMode;

  const [options, setOptions] = useState<AssigneeOptions | null>(null);
  // Pending type switch awaiting confirmation — switching type clears the
  // selected assignees, so it is confirmed first (selections are single-type).
  const [confirmSwitch, setConfirmSwitch] = useState<AssigneeMode | null>(null);

  useEffect(() => {
    (async () => {
      const o = await fetchAssigneeOptions();
      if (o) setOptions(o);
    })();
  }, []);

  // A type switch that actually happened (or an external change) dismisses
  // the pending confirmation.
  useEffect(() => {
    setConfirmSwitch(null);
  }, [mode]);

  const applyMode = (m: AssigneeMode) => {
    // Switching type clears the selection — the assignee type cannot be mixed.
    onChange({ routerType: m, routerValue: '', routerRefs: [] });
    setConfirmSwitch(null);
  };

  const setMode = (m: AssigneeMode) => {
    if (m === mode) return;
    if (routerRefs.length > 0) { setConfirmSwitch(m); return; }
    applyMode(m);
  };

  const setValue = (v: string) => {
    onChange({ routerValue: v });
  };

  // VariableTextInput works in {{name}} moustache tokens; the runtime reads a
  // single plain variable name from routerValue, so unwrap the chip back to it.
  const toVariableName = (raw: string): string => {
    const refs = [...raw.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1].trim()).filter(Boolean);
    if (refs.length === 1) return refs[0];
    return raw.replace(/\{\{[^{}]*\}\}/g, '').trim();
  };

  // ── Chip-based multi-select (User / Position / Team) ──
  const isChipMode = STATIC_MODES.includes(mode);
  const tokenFor = (value: string) => (value.includes(':') ? value.trim() : `${mode}:${value.trim()}`);

  // A legacy single value (saved before chips) is shown as one removable chip;
  // adding any new chip converts it into a ref token so nothing is lost.
  const legacyChip = isChipMode && routerValue && !routerRefs.some((r) => r.startsWith(`${mode}:`))
    ? routerValue
    : '';

  const chipLabel = (token: string): string => {
    const i = token.indexOf(':');
    const t = i > 0 ? token.slice(0, i) : mode;
    const v = i > 0 ? token.slice(i + 1) : token;
    if (options) {
      if (t === 'user') {
        const u = options.users.find((x) => x.id === v);
        if (u) return `${u.name}${u.email ? ` (${u.email})` : ''}`;
      } else if (t === 'role') {
        return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      } else if (t === 'position') {
        const p = options.positions.find((x) => x.id === v);
        if (p) return p.name;
      } else if (t === 'team') {
        const tm = options.teams.find((x) => x.id === v || x.name === v);
        if (tm) return tm.name;
      }
    }
    return token;
  };

  const addChip = (value: string) => {
    if (!value.trim()) return;
    const next = [...routerRefs];
    if (legacyChip) next.push(tokenFor(legacyChip));
    const token = tokenFor(value);
    if (!next.includes(token)) next.push(token);
    onChange({ routerRefs: next, routerValue: '' });
  };

  // ── Option lists per static mode with member count indicators ──
  const staticOptions = useMemo(() => {
    if (!options) return [];
    if (mode === 'role') {
      return (options.roles || []).map((r) => {
        const clean = r.toUpperCase().replace(/\s+/g, '_');
        const count = options.users.filter((u: any) => u.role === r || u.role === clean || (u.role && u.role.toLowerCase() === r.toLowerCase())).length;
        const countLabel = count > 0 ? ` (${count} user${count > 1 ? 's' : ''})` : ' (0 users ⚠️)';
        return {
          value: r,
          label: `${r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}${countLabel}`,
        };
      });
    }
    if (mode === 'team') {
      return options.teams.map((t: any) => {
        const count = typeof t.memberCount === 'number' ? ` (${t.memberCount} member${t.memberCount !== 1 ? 's' : ''})` : '';
        return { value: t.id, label: `${t.name}${count}` };
      });
    }
    if (mode === 'position') {
      return options.positions.map((p: any) => {
        const count = typeof p.slotCount === 'number' ? ` (${p.slotCount} holder${p.slotCount !== 1 ? 's' : ''})` : '';
        return { value: p.id, label: `${p.name}${count}` };
      });
    }
    if (mode === 'user') return options.users.map((u) => ({ value: u.id, label: `${u.name}${u.email ? ` (${u.email})` : ''}` }));
    return [];
  }, [options, mode]);

  // ── Variable options ──
  const varVariables = useMemo(
    () => variables.filter((v) => v.name && VAR_LIKE_TYPES.has((v.fieldType || 'text').toLowerCase())),
    [variables],
  );

  // ── Multi-assignee ──
  const multi = routerRefs.length > 0;
  const removeRef = (token: string) => {
    onChange({ routerRefs: routerRefs.filter((r) => r !== token) });
  };

  const meta = MODES.find((m) => m.mode === mode);

  return (
    <div className="atr__field">
      {/* Segmented mode switcher */}
      <div className="atr__seg" role="group" aria-label="Assign to">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            title={m.hint}
            className={`atr__seg-opt${mode === m.mode ? ' is-active' : ''}`}
            onClick={() => setMode(m.mode)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <p className="atr__hint"><Info size={11} /> {meta?.hint}</p>

      {/* Type-switch confirmation — a selection is single-type; switching
          clears the selected assignees. */}
      {confirmSwitch && (
        <div className="atr__confirm" role="alert">
          <span>
            Switch to {MODES.find((m) => m.mode === confirmSwitch)?.label}? The selected {MODES.find((m) => m.mode === mode)?.label.toLowerCase()}s will be cleared.
          </span>
          <div className="atr__confirm-actions">
            <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => applyMode(confirmSwitch)}>Switch</button>
            <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setConfirmSwitch(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Static reference modes — chip-based multi-select */}
      {isChipMode && (
        <div className="atr__body">
          <div className="atr__row">
            <CustomSelect
              size="md"
              searchable
              value=""
              options={staticOptions}
              onChange={(v) => addChip(String(v))}
              placeholder={mode === 'user' ? 'Search people to add…' : mode === 'role' ? 'Search roles to add…' : mode === 'position' ? 'Search positions to add…' : 'Search teams to add…'}
            />
          </div>
        </div>
      )}

      {/* Variable */}
      {mode === 'variable' && (
        <div className="atr__body">
          <VariableTextInput
            value={routerValue ? `{{${routerValue}}}` : ''}
            onChange={(raw) => setValue(toVariableName(raw))}
            variables={varVariables}
            recordSchemas={recordSchemas}
            recordSchema={recordSchema}
            placeholder="Pick or type a workflow variable…"
          />
          <div className="atr__kind" role="group" aria-label="Variable holds">
            <span className="atr__kind-label">Variable holds</span>
            {(['user', 'team', 'position'] as const).map((k) => (
              <button
                key={k}
                type="button"
                title={k === 'user' ? 'A user id / email' : k === 'team' ? 'A team name or id' : 'A position name or id'}
                className={`atr__seg-opt${routerValueType === k ? ' is-active' : ''}`}
                onClick={() => onChange({ routerValueType: k })}
              >
                {k === 'user' ? 'User' : k === 'team' ? 'Team' : 'Position'}
              </button>
            ))}
          </div>
          <p className="atr__note">The variable is read at task time. The "holds" kind decides how its value resolves — a plain id / email / name is treated as that kind; an explicit <code>team:…</code> or <code>position:…</code> prefix in the value always wins.</p>
        </div>
      )}

      {/* Multi-assignee chips */}
      {(multi || legacyChip) && (
        <div className="atr__multi">
          <span className="atr__multi-title">This task goes to every reference:</span>
          {legacyChip && (
            <span className="atr__chip" title={legacyChip}>
              {chipLabel(legacyChip)}
              <button type="button" title="Remove" onClick={() => setValue('')}><X size={10} /></button>
            </span>
          )}
          {routerRefs.map((r) => (
            <span key={r} className="atr__chip" title={r}>
              {chipLabel(r)}
              <button type="button" title="Remove" onClick={() => removeRef(r)}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const AssignToEditor: React.FC<AssignToEditorProps> = ({
  config, onConfigChange, variables, recordSchema, recordSchemas, onOpenAssigneeRuleCondition,
}) => {
  const rules = useMemo<AssigneeRule[]>(
    () => (Array.isArray(config.assigneeRules) ? config.assigneeRules : []),
    [config.assigneeRules],
  );

  const setRules = (next: AssigneeRule[]) => onConfigChange('assigneeRules', next);

  const addRule = () => {
    setRules([...rules, { id: genRuleId(), routerType: 'team', routerRefs: [], conditionGroups: [] }]);
  };
  const updateRule = (id: string, patch: Record<string, any>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };
  const moveRule = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    setRules(next);
  };

  const setDefault = (patch: Record<string, any>) => {
    for (const [k, v] of Object.entries(patch)) onConfigChange(k, v);
  };

  return (
    <div className="atr">
      {/* ── Assignee Conditions (ordered, first match wins) ── */}
      <div className="atr__rules">
        <div className="atr__rules-head">
          <span className="atr__rules-title">Assignee Conditions</span>
          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addRule} title="Add a conditional assignee rule">
            <Plus size={12} /> Add condition
          </button>
        </div>
        <p className="atr__note">Rules are evaluated top-to-bottom at task time — the first matching condition's assignees get the task.</p>
        {rules.map((rule, i) => (
          <div key={rule.id} className="atr__rule">
            <div className="atr__rule-row">
              <button
                type="button"
                className="atr__cond-chip"
                disabled={!onOpenAssigneeRuleCondition}
                onClick={() => onOpenAssigneeRuleCondition?.(rule.id)}
                title={onOpenAssigneeRuleCondition ? 'Build the condition with QueryStudio…' : 'Condition builder unavailable'}
              >
                <Filter size={11} /> {assigneeRuleConditionSummary(rule)}
              </button>
              <div className="atr__rule-actions">
                <button type="button" title="Move up" disabled={i === 0} onClick={() => moveRule(i, -1)}><ChevronUp size={12} /></button>
                <button type="button" title="Move down" disabled={i === rules.length - 1} onClick={() => moveRule(i, 1)}><ChevronDown size={12} /></button>
                <button type="button" title="Remove condition" onClick={() => removeRule(rule.id)}><Trash2 size={12} /></button>
              </div>
            </div>
            <AssigneeField
              value={rule}
              onChange={(patch) => updateRule(rule.id, patch)}
              variables={variables}
              recordSchema={recordSchema}
              recordSchemas={recordSchemas}
            />
          </div>
        ))}
      </div>

      {/* ── Default assignees (fallback) ── */}
      <div className="atr__default">
        <div className="atr__rules-head">
          <span className="atr__rules-title">Default assignees</span>
        </div>
        <p className="atr__note">Used when no condition above matches — and when there are no conditions at all.</p>
        <AssigneeField
          value={{
            routerType: (config.routerType as string) || 'team',
            routerValue: config.routerValue,
            routerRefs: config.routerRefs,
            routerValueType: config.routerValueType,
          }}
          onChange={setDefault}
          variables={variables}
          recordSchema={recordSchema}
          recordSchemas={recordSchemas}
        />
      </div>
    </div>
  );
};

export default AssignToEditor;