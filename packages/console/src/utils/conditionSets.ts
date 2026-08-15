/**
 * conditionSets — evaluation helpers shared by the Layout Studio preview and
 * the DynamicDetailPage runtime.
 *
 * A Condition Set is active when its JSONata `condition` evaluates truthy
 * against the record + form variables; a rule is active when its own
 * `condition` also passes. Behavior rules override a block's control state
 * (LAST matching rule wins, in rule order), formatting rules merge their
 * styles (later rules override the same properties), validation rules
 * accumulate per target block.
 */
import jsonata from 'jsonata';
import { registerExpressionFunctions, type ConditionSet, type ConditionSetRule, type ConditionSetStyle } from '@sails/shared';

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

function evalTrue(expression: string | undefined, ctx: Record<string, any>): boolean {
  if (!expression || !expression.trim()) return true;
  try {
    const fn = jsonata(expression);
    registerExpressionFunctions(fn);
    return !!fn.evaluate(ctx);
  } catch {
    return true; // fail open — never hide/block the form because of a bad expression
  }
}

/** Active rules: set condition true AND rule condition true. */
export function resolveActiveRules(sets: ConditionSet[] | undefined, ctx: Record<string, any>): ConditionSetRule[] {
  const active: ConditionSetRule[] = [];
  for (const set of sets || []) {
    if (!evalTrue(set?.condition, ctx)) continue;
    for (const rule of set?.rules || []) {
      if (!rule?.id) continue;
      if (!evalTrue(rule.condition, ctx)) continue;
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
