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
  /** Validation rules per block ('all' rules included), in rule order. */
  validationsOf: (blockId: string) => NonNullable<ConditionSetRule['validation']>[];
}

const DEFAULT_STATE: ConditionBlockState = { hidden: false, readOnly: false, editable: true };

// ── Set/rule resolution ───────────────────────────────────────

/** Active rules: set groups match AND rule groups match. */
export function resolveActiveRules(sets: ConditionSet[] | undefined, ctx: FilterEvalContext): ConditionSetRule[] {
  const active: ConditionSetRule[] = [];
  for (const set of sets || []) {
    if (!evaluateFilterGroups(set?.conditionGroups, ctx)) continue;
    for (const rule of set?.rules || []) {
      if (!rule?.id) continue;
      if (!evaluateFilterGroups(rule.conditionGroups, ctx)) continue;
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
    editable: effect.editable === true && effect.readOnly !== true,
  };
}

/** Derive per-block state / styles / validations from active rules. */
export function deriveConditionSets(activeRules: ConditionSetRule[]): ConditionSetsDerived {
  const stateByBlock = new Map<string, ConditionBlockState>();
  const stylesByBlock = new Map<string, ConditionSetStyle>();
  const validationsByBlock = new Map<string, NonNullable<ConditionSetRule['validation']>[]>();
  let allEffect: NonNullable<ConditionSetRule['effect']> | undefined;
  let allStyle: ConditionSetStyle | undefined;
  const allValidations: NonNullable<ConditionSetRule['validation']>[] = [];

  for (const rule of activeRules) {
    const isAll = rule.targetBlockIds === 'all';
    const ids = isAll ? [] : (rule.targetBlockIds as string[]);
    if (rule.kind === 'behavior' && rule.effect) {
      const st = stateOf(rule.effect);
      if (isAll) allEffect = rule.effect;
      else for (const id of ids) stateByBlock.set(id, st);
    } else if (rule.kind === 'formatting' && rule.style) {
      if (isAll) allStyle = mergeStyle(allStyle, rule.style);
      else for (const id of ids) stylesByBlock.set(id, mergeStyle(stylesByBlock.get(id), rule.style));
    } else if (rule.kind === 'validation' && rule.validation) {
      if (isAll) {
        allValidations.push(rule.validation);
      } else {
        for (const id of ids) {
          const list = validationsByBlock.get(id) || [];
          list.push(rule.validation!);
          validationsByBlock.set(id, list);
        }
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
    validationsOf: (blockId) => [...allValidations, ...(validationsByBlock.get(blockId) || [])],
  };
}
