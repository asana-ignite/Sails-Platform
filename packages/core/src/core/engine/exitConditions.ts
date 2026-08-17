/**
 * exitConditions — pure evaluation of a stage's Exit Conditions.
 *
 * Each outgoing line (branch) may carry an approval decision it follows
 * (`action` + a vote policy) plus an optional data gate built with the
 * Query-Studio Condition builder (`conditionGroups` — FilterGroup[] over the
 * workflow's root table, `@var.*` variables and Expression f(x)). After every
 * assignee vote the engine re-evaluates the lines IN ORDER; the first line
 * whose vote-policy AND gate are satisfied is the exit taken (and it resolves
 * the task to that decision).
 *
 * Legacy JSONata `expression` gates are no longer evaluated — an unmigrated
 * line simply has no data gate until it is edited in Workflow Studio.
 */
import type { FilterEvalContext, FilterGroup } from '@sails/shared';
import { evaluateFilterGroups } from '@sails/shared';

export type VoteLookup = Record<string, { action: string; comment?: string | null; at?: string }>;

export type VotePolicyBranch = {
  id: string;
  action?: string;
  votePolicy?: 'all' | 'any' | 'at_least';
  voteCount?: number;
  /** Query-Studio Condition-builder groups — the line's data gate. */
  conditionGroups?: FilterGroup[];
  /** @deprecated Legacy JSONata gate — kept for storage compat, never evaluated. */
  expression?: string;
};

export interface ExitEvalContext {
  variables: Record<string, any>;
  stageId: string;
  assigneeCount: number;
  /** Root record (trigger values + id) for field-path LHS rules. */
  record?: Record<string, any>;
  /** Root table fields (id → fieldName) for field-path LHS/RHS rules. */
  fields?: { id: string; fieldName: string }[];
  /** The deciding user — resolves @me / @user.* macros. */
  user?: { id?: string };
}

export interface ExitMatch {
  branch: VotePolicyBranch;
  /** The decision the task resolves to. */
  action?: string;
}

export interface ExitEvaluator {
  /** Evaluate a Condition-builder group set against the exit context. */
  evaluateGroups: (groups: FilterGroup[], evalCtx: FilterEvalContext) => Promise<boolean>;
  /** Sync JSONata for the Expression f(x) RHS source. */
  evaluateExpression: (expression: string, input: any) => any;
}

/** Number of assignees who voted for the given decision. */
export function countVotesFor(votes: VoteLookup, action: string): number {
  return Object.values(votes).filter((v) => v.action === action).length;
}

/** True when the branch's vote policy is satisfied by the current votes. */
export function policySatisfied(
  votes: VoteLookup,
  assigneeCount: number,
  branch: VotePolicyBranch,
): boolean {
  if (!branch.action) return false;
  const n = countVotesFor(votes, branch.action);
  if (branch.votePolicy === 'all') {
    // Every assignee must have picked this decision.
    return assigneeCount > 0 && n === assigneeCount;
  }
  if (branch.votePolicy === 'at_least') {
    return n >= (branch.voteCount ?? 1);
  }
  return n >= 1; // any
}

/** The most-voted decision (ties → the first one seen). Used when a line without
 *  a decision matches, so the task still gets a displayable outcome. */
export function majorityAction(votes: VoteLookup): string | undefined {
  const counts = new Map<string, number>();
  for (const v of Object.values(votes)) {
    counts.set(v.action, (counts.get(v.action) || 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [action, n] of counts) {
    if (n > bestN) { best = action; bestN = n; }
  }
  return best;
}

/**
 * Evaluate the stage's outgoing lines in order. A line matches when:
 *  - its vote policy (if it has an action) is satisfied, AND
 *  - its optional Condition-builder gate matches (or it has none).
 * Returns the first match, or null while the stage stays open.
 */
export async function evaluateExitConditions(
  votes: VoteLookup,
  branches: VotePolicyBranch[],
  ctx: ExitEvalContext,
  evaluator: ExitEvaluator,
): Promise<ExitMatch | null> {
  const votesArr = Object.values(votes).map((v) => v.action);
  const evalCtx: FilterEvalContext = {
    record: ctx.record || {},
    vars: ctx.variables,
    fields: (ctx.fields || []) as any,
    user: ctx.user as any,
    evaluateExpression: evaluator.evaluateExpression,
    // Mirrors the legacy JSONata gate context — Expression f(x) rules can
    // reference the accumulated votes and the assignee count.
    expressionContext: {
      votes: votesArr,
      assigneeCount: ctx.assigneeCount,
      [`decision_${ctx.stageId}`]: null,
    },
  };
  for (const branch of branches) {
    if (branch.action) {
      if (!policySatisfied(votes, ctx.assigneeCount, branch)) continue;
    }
    const groups = Array.isArray(branch.conditionGroups) ? branch.conditionGroups : [];
    const hasGroups = groups.some((g) => (g?.rules || []).length > 0);
    if (hasGroups && !(await evaluator.evaluateGroups(groups, evalCtx))) continue;
    return { branch, action: branch.action };
  }
  return null;
}
