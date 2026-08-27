/**
 * filterEvaluation — client-side evaluation of Query-Studio FilterGroup[]
 * against a single record (+ form variables). Mirrors the server-side
 * record-filter semantics for the operators the builder offers, so Layout
 * Studio previews, the DynamicDetailPage runtime and the form-event route all
 * agree.
 *
 * Sources:
 *  - (default) 'value'  → literal rule.value
 *  - 'field'            → another field's value on the same record (refFieldId)
 *  - 'context'          → `@var.<name>` (form variables), `@me` / `@user.role` /
 *    `@user.email` (current user), `@today/@yesterday/@tomorrow` (date strings),
 *    `@now` / `request_date` (ISO datetime)
 *  - 'expression'       → JSONata in rule.value, evaluated with record + vars + user
 *  - 'record'/'workflow' + `@my_team` / `@my_subordinates` / `@this_*` /
 *    N-period macros → no match (server-only)
 *
 * The LHS fieldId may also be a context macro (`@var.<name>`, `@me`, …) when
 * the builder's Context mode is used.
 */
import type { FilterGroup, FilterRule, SailsFieldDefinition } from './index';

export interface FilterEvalUser {
  id?: string;
  role?: string;
  email?: string;
  activeTeamId?: string;
}

export interface FilterEvalContext {
  record: Record<string, any>;
  vars: Record<string, any>;
  /** Current user — resolves @me / @user.role / @user.email macros. */
  user?: FilterEvalUser;
  /** Model fields — resolves filter fieldId → fieldName for record lookups. */
  fields: SailsFieldDefinition[];
  /** JSONata evaluator for the Expression f(x) source (host-injected).
   *  May return a value OR a Promise (jsonata 2.x evaluate() is always
   *  async) — awaited either way. When absent, expression rules never match. */
  evaluateExpression?: (expr: string, input: any) => any;
  /** Extra keys merged into the Expression f(x) input (host-specific context
   *  such as workflow votes/assigneeCount). Canonical keys win. */
  expressionContext?: Record<string, any>;
}

function fieldNameOf(fieldId: string, ctx: FilterEvalContext): string {
  const f = (ctx.fields || []).find((x) => x.id === fieldId || x.fieldName === fieldId);
  return f?.fieldName || fieldId;
}

function recordValue(fieldId: string, ctx: FilterEvalContext): any {
  if (fieldId.startsWith('@')) return contextMacroValue(fieldId, ctx).value;
  return (ctx.record || {})[fieldNameOf(fieldId, ctx)];
}

function dateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

/** Deep-get a dotted path through an object (numeric segments index arrays).
 *  Returns undefined when any segment is unresolvable. */
function getPath(value: any, segs: string[]): any {
  let cur = value;
  for (const seg of segs) {
    if (cur == null) return undefined;
    const idx = /^\d+$/.test(seg) ? parseInt(seg, 10) : null;
    if (Array.isArray(cur)) {
      if (idx == null || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
    } else {
      cur = cur[seg];
    }
  }
  return cur;
}

/** Resolve a context macro; `matched: false` = unsupported (server-only). */
function contextMacroValue(macro: string, ctx: FilterEvalContext): { matched: boolean; value: any } {
  if (macro.startsWith('@var.')) {
    // @var.<name> (top-level) and @var.<name>.<path> (record-variable fields).
    // Unresolvable paths never match — a broken reference can't pass the rule.
    const path = macro.slice(5).split('.').filter(Boolean);
    if (path.length === 0) return { matched: false, value: undefined };
    return { matched: true, value: getPath(ctx.vars?.[path[0]], path.slice(1)) };
  }
  if (macro === '@today') return { matched: true, value: dateStr(new Date()) };
  if (macro === '@yesterday') return { matched: true, value: shiftDays(-1) };
  if (macro === '@tomorrow') return { matched: true, value: shiftDays(1) };
  if (macro === '@now' || macro === 'request_date') return { matched: true, value: new Date().toISOString() };
  if (macro === '@me') return { matched: !!ctx.user?.id, value: ctx.user?.id };
  if (macro === '@user.role') return { matched: !!ctx.user?.role, value: ctx.user?.role };
  if (macro === '@user.email') return { matched: !!ctx.user?.email, value: ctx.user?.email };
  return { matched: false, value: undefined }; // @my_team / @my_subordinates / @this_* / N-period — server-side only
}

/** Resolve the RHS of a rule; `matched: false` = unsupported source (no match). */
async function resolveRhs(rule: FilterRule, ctx: FilterEvalContext): Promise<{ matched: boolean; value: any }> {
  switch (rule.valueSource) {
    case 'field':
      return { matched: true, value: recordValue(rule.refFieldId || '', ctx) };
    case 'context':
      return contextMacroValue(rule.contextMacro || '', ctx);
    case 'expression': {
      const expr = rule.value || '';
      if (!expr.trim() || !ctx.evaluateExpression) return { matched: false, value: undefined };
      const input = {
        ...(ctx.expressionContext || {}),
        ...(ctx.record || {}),
        record: ctx.record || {},
        vars: ctx.vars || {},
        variables: ctx.vars || {},
        user: ctx.user || {},
      };
      // The host evaluator may be async (jsonata 2.x evaluate() returns a
      // Promise even for pure expressions) — await it either way.
      const value = await ctx.evaluateExpression(expr, input);
      return { matched: true, value };
    }
    case 'record':
    case 'workflow':
      return { matched: false, value: undefined }; // server-only sources
    default:
      return { matched: true, value: rule.value };
  }
}

function compare(op: string, lhs: any, rhs: any): boolean {
  if (op === 'is_empty') return lhs === undefined || lhs === null || String(lhs).trim() === '';
  if (op === 'is_not_empty') return lhs !== undefined && lhs !== null && String(lhs).trim() !== '';
  if (op === 'eq') {
    if (lhs == null && rhs == null) return true;
    if (lhs == null || rhs == null) return false;
    return String(lhs) === String(rhs);
  }
  if (op === 'neq') {
    if (lhs == null && rhs == null) return false;
    if (lhs == null || rhs == null) return true;
    return String(lhs) !== String(rhs);
  }
  if (op === 'contains') return String(lhs ?? '').toLowerCase().includes(String(rhs ?? '').toLowerCase());
  const ln = Number(lhs);
  const rn = Number(rhs);
  if (Number.isNaN(ln) || Number.isNaN(rn)) return false;
  switch (op) {
    case 'gt': return ln > rn;
    case 'gte': return ln >= rn;
    case 'lt': return ln < rn;
    case 'lte': return ln <= rn;
    default: return false;
  }
}

async function evalRule(rule: FilterRule, ctx: FilterEvalContext): Promise<boolean> {
  const lhs = recordValue(rule.fieldId, ctx);
  const rhs = await resolveRhs(rule, ctx);
  if (!rhs.matched) return false;
  return compare(rule.operator, lhs, rhs.value);
}

async function evalGroup(group: FilterGroup, ctx: FilterEvalContext): Promise<boolean> {
  const rules = group?.rules || [];
  if (rules.length === 0) return true;
  let result = await evalRule(rules[0], ctx);
  for (let i = 1; i < rules.length; i++) {
    const next = await evalRule(rules[i], ctx);
    result = rules[i].logic === 'or' ? (result || next) : (result && next);
  }
  return result;
}

/** Evaluate Query-Studio filter groups against a single record + vars.
 *  Empty/absent groups → true (always active). */
export async function evaluateFilterGroups(groups: FilterGroup[] | undefined, ctx: FilterEvalContext): Promise<boolean> {
  if (!groups || groups.length === 0) return true;
  let result = await evalGroup(groups[0], ctx);
  for (let i = 1; i < groups.length; i++) {
    const next = await evalGroup(groups[i], ctx);
    result = groups[i].groupLogic === 'or' ? (result || next) : (result && next);
  }
  return result;
}
