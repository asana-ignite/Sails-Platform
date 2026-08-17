/**
 * conditionSets — evaluation helpers shared by the Layout Studio preview and
 * the DynamicDetailPage runtime.
 *
 * A Condition Set is active when its Query-Studio `conditionGroups` match the
 * record + form variables; a rule is active when its own `conditionGroups`
 * also match (empty/absent groups = always active). Behavior rules override a
 * block's control state (LAST matching rule wins, in rule order), formatting
 * rules merge their styles (later rules override the same properties),
 * validation rules accumulate per target block.
 */
import jsonata from 'jsonata';
import type { ConditionSet, ConditionSetRule, ConditionSetStyle, SailsFieldDefinition } from '@sails/shared';
import { evaluateFilterGroups, registerExpressionFunctions, type FilterEvalContext, type FilterEvalUser } from '@sails/shared';

export type ConditionEvalContext = FilterEvalContext;

/** Console JSONata evaluator for the Expression f(x) source. */
function evalExpression(expr: string, input: any): any {
  try {
    const fn = jsonata(expr);
    registerExpressionFunctions(fn);
    return fn.evaluate(input);
  } catch {
    return undefined;
  }
}

/** Build a full evaluation context (record + vars + fields + user + expression). */
export function conditionEvalContext(
  record: Record<string, any>,
  vars: Record<string, any>,
  fields: SailsFieldDefinition[],
  user?: FilterEvalUser,
): FilterEvalContext {
  return { record, vars, fields, user, evaluateExpression: evalExpression };
}

export interface ConditionBlockState {
  hidden: boolean;
  readOnly: boolean;
  editable: boolean;
}

export interface ConditionSetsDerived {
  /** Per-block control state (behavior rules, last match wins). */
  stateOf: (blockId: string) => ConditionBlockState;
  /** Merged formatting styles per block ('all' rules included). */
  stylesOf: (blockId: string) => ConditionSetStyle | undefined;
}

const DEFAULT_STATE: ConditionBlockState = { hidden: false, readOnly: false, editable: true };

// ── Set/rule resolution ───────────────────────────────────────

/** Active rules: set groups match AND rule groups match. */
export async function resolveActiveRules(sets: ConditionSet[] | undefined, ctx: FilterEvalContext): Promise<ConditionSetRule[]> {
  const active: ConditionSetRule[] = [];
  for (const set of sets || []) {
    if (!(await evaluateFilterGroups(set?.conditionGroups, ctx))) continue;
    for (const rule of set?.rules || []) {
      if (!rule?.id) continue;
      if (!(await evaluateFilterGroups(rule.conditionGroups, ctx))) continue;
      active.push(rule);
    }
  }
  return active;
}

function mergeStyle(base: ConditionSetStyle | undefined, style: ConditionSetStyle | undefined): ConditionSetStyle {
  return { ...(base || {}), ...(style || {}) };
}

function stateOf(effect: NonNullable<ConditionSetRule['effect']>): ConditionBlockState {
  return {
    hidden: effect.visible === false,
    readOnly: effect.readOnly === true || effect.editable === false,
    editable: effect.editable !== false && effect.readOnly !== true,
  };
}

/** Derive per-block state / styles / validations from active rules. */
export function deriveConditionSets(activeRules: ConditionSetRule[]): ConditionSetsDerived {
  const stateByBlock = new Map<string, ConditionBlockState>();
  const stylesByBlock = new Map<string, ConditionSetStyle>();
  let allEffect: NonNullable<ConditionSetRule['effect']> | undefined;
  let allStyle: ConditionSetStyle | undefined;

  for (const rule of activeRules) {
    const isControl = rule.kind === 'control' || (rule.kind as string) === 'behavior'; // legacy
    const isAll = rule.targetBlockIds === 'all';
    const ids = isAll ? [] : ((rule.targetBlockIds as string[] | undefined) || []);
    if (isControl) {
      // Field Control: All-row state (effect) + per-block states (targetStates).
      if (rule.effect) allEffect = rule.effect;
      if (rule.targetStates) {
        for (const [id, st] of Object.entries(rule.targetStates)) {
          if (st) stateByBlock.set(id, stateOf(st));
        }
      }
      // Legacy migration fallback: per-block target list + one effect.
      if (!rule.targetStates && rule.effect && Array.isArray(rule.targetBlockIds)) {
        for (const id of rule.targetBlockIds) stateByBlock.set(id, stateOf(rule.effect));
      }
    } else if (rule.kind === 'formatting' && (rule.style || rule.targetStyles)) {
      if (rule.targetStyles) {
        for (const [id, st] of Object.entries(rule.targetStyles)) {
          if (st) stylesByBlock.set(id, mergeStyle(stylesByBlock.get(id), st));
        }
        // All-row style = default for blocks without their own entry.
        if (rule.style) allStyle = mergeStyle(allStyle, rule.style);
      } else if (isAll) {
        if (rule.style) allStyle = mergeStyle(allStyle, rule.style);
      } else {
        // Legacy fallback: per-block target list + one style.
        for (const id of ids) stylesByBlock.set(id, mergeStyle(stylesByBlock.get(id), rule.style));
      }
    }
  }

  return {
    stateOf: (blockId) => {
      const own = stateByBlock.get(blockId);
      if (own) return own;
      return allEffect ? stateOf(allEffect) : DEFAULT_STATE;
    },
    stylesOf: (blockId) => stylesByBlock.get(blockId) || allStyle || undefined,
  };
}
