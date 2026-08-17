/**
 * Unit tests for: exit-condition evaluation (vote policies + Query-Studio
 * Condition-builder gates). PURE — no database, no plugin init.
 *
 * Covers: first-match-in-order, vote policies (all/any/at_least), field-rule
 * gates against the root record, @var.* context macros, Expression f(x) RHS,
 * and the legacy JSONata gate being ignored (unmigrated lines have no gate).
 */
import { evaluateExitConditions, majorityAction, policySatisfied } from '@/core/engine/exitConditions';
import type { ExitEvaluator, VoteLookup, VotePolicyBranch } from '@/core/engine/exitConditions';
import type { FilterGroup } from '@sails/shared';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonataLib = require('jsonata') as (e: string) => any;

let failures = 0;
function check(label: string, ok: boolean, extra?: any) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failures++;
}

const evaluator: ExitEvaluator = {
  evaluateGroups: (groups: FilterGroup[], evalCtx) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { evaluateFilterGroups } = require('@sails/shared');
    return evaluateFilterGroups(groups, evalCtx);
  },
  evaluateExpression: (expr: string, input: any): any => {
    try {
      return jsonataLib(expr).evaluate(input);
    } catch {
      return undefined;
    }
  },
};

const branch = (p: Partial<VotePolicyBranch> & { id: string }): VotePolicyBranch => ({
  action: p.action,
  votePolicy: p.votePolicy,
  voteCount: p.voteCount,
  conditionGroups: p.conditionGroups,
  expression: p.expression,
  ...p,
});

const votes: VoteLookup = { a: { action: 'approve' }, b: { action: 'approve' } };

const g = (rules: FilterGroup['rules']): FilterGroup[] => [{ id: 'g1', name: '1', groupLogic: 'and', rules }];

const rule = (p: Partial<FilterGroup['rules'][number]>): FilterGroup['rules'][number] => ({
  id: 'r1',
  fieldId: 'f_amount',
  operator: 'gt',
  value: '1000',
  logic: 'and',
  valueSource: 'value',
  ...p,
});

async function main() {
  // ── Vote policies ──
  check('policySatisfied at_least 2/2', policySatisfied(votes, 2, branch({ id: 'x', action: 'approve', votePolicy: 'at_least', voteCount: 2 })));
  check('policySatisfied all 2/3 false', !policySatisfied(votes, 3, branch({ id: 'x', action: 'approve', votePolicy: 'all' })));
  check('policySatisfied any', policySatisfied({ a: { action: 'approve' } }, 2, branch({ id: 'x', action: 'approve', votePolicy: 'any' })));
  check('majorityAction tie→first', majorityAction({ a: { action: 'approve' }, b: { action: 'reject' } }) === 'approve');

  const ctx = {
    variables: { values: { amount: 5000 }, recordId: 'rec_1', amount: 5000 },
    stageId: 'st_1',
    assigneeCount: 2,
    record: { amount: 5000, id: 'rec_1' },
    fields: [{ id: 'f_amount', fieldName: 'amount' }],
    user: { id: 'a' },
  };

  // ── First match in order (policy + gate) ──
  let r = await evaluateExitConditions(votes, [
    branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 2, conditionGroups: g([rule({ value: '9000' })]) }),
    branch({ id: 'b2', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({})]) }),
  ], ctx, evaluator);
  check('first line gated out → second matches', r?.branch.id === 'b2', r?.branch.id);

  // ── Field rule against the root record ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ operator: 'gte' })]) })], ctx, evaluator);
  check('field gate amount >= 5000 matches', !!r, r?.branch.id);

  // ── @var context macro (workflow variable) ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@var.amount', operator: 'gt', value: '100' })]) })], ctx, evaluator);
  check('@var.amount context macro matches', !!r);

  // ── User macros (@me / @user.role / @user.email) ──
  const userCtx = { ...ctx, user: { id: 'u_1', role: 'MANAGER', email: 'boss@klao.app' } };
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@me', operator: 'eq', value: 'u_1' })]) })], userCtx, evaluator);
  check('@me matches the deciding user', !!r);
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@user.role', operator: 'eq', value: 'MANAGER' })]) })], userCtx, evaluator);
  check('@user.role matches', !!r);
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@user.email', operator: 'eq', value: 'boss@klao.app' })]) })], userCtx, evaluator);
  check('@user.email matches', !!r);

  // ── Date macros resolve (@today is the current date string) ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@today', operator: 'eq', value: new Date().toISOString().slice(0, 10) })]) })], ctx, evaluator);
  check('@today matches the current date', !!r);

  // ── Generic macros excluded from the curated list never match ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ fieldId: '@this_month', operator: 'eq', value: 'x' })]) })], ctx, evaluator);
  check('@this_month never matches (excluded from curated list)', r === null);

  // ── Expression f(x) RHS source ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ operator: 'gt', valueSource: 'expression', value: 'votes.length >= 2 ? record.amount : 0' })]) })], ctx, evaluator);
  check('Expression f(x) with votes context matches', !!r);

  // ── Empty groups → always (no gate) ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: [] })], ctx, evaluator);
  check('empty groups always match', !!r);

  // ── Legacy JSONata expression ignored (unmigrated line has no gate) ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, expression: 'amount > 999999' })], ctx, evaluator);
  check('legacy JSONata expression ignored', !!r);

  // ── Unsupported RHS source (record/workflow) → no match ──
  r = await evaluateExitConditions(votes, [branch({ id: 'b1', action: 'approve', votePolicy: 'at_least', voteCount: 1, conditionGroups: g([rule({ valueSource: 'workflow', workflowRef: '{{requestor.name}}' })]) })], ctx, evaluator);
  check('workflow RHS source never matches', r === null, r?.branch?.id);

  console.log(failures === 0 ? '\nAll exit-condition unit tests passed.' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
