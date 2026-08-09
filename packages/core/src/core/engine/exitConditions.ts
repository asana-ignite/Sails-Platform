/**
 * exitConditions — pure evaluation of a stage's Exit Conditions.
 *
 * Each outgoing line (branch) may carry an approval decision it follows
 * (`action` + a vote policy) plus an optional JSONata data gate. After every
 * assignee vote the engine re-evaluates the lines IN ORDER; the first line
 * whose vote-policy AND gate are satisfied is the exit taken (and it resolves
 * the task to that decision).
 */

export type VoteLookup = Record<string, { action: string; comment?: string | null; at?: string }>;

export type VotePolicyBranch = {
  id: string;
  action?: string;
  votePolicy?: 'all' | 'any' | 'at_least';
  voteCount?: number;
  expression?: string;
};

export interface ExitEvalContext {
  variables: Record<string, any>;
  stageId: string;
  assigneeCount: number;
}

export interface ExitMatch {
  branch: VotePolicyBranch;
  /** The decision the task resolves to. */
  action?: string;
}

export interface ExitEvaluator {
  /** Evaluate a JSONata gate against the merged context. */
  evaluate: (expression: string, ctx: Record<string, any>) => Promise<{ ok: boolean; value?: any }>;
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
 *  - its optional JSONata gate is truthy (or absent).
 * Returns the first match, or null while the stage stays open.
 */
export async function evaluateExitConditions(
  votes: VoteLookup,
  branches: VotePolicyBranch[],
  ctx: ExitEvalContext,
  evaluator: ExitEvaluator,
): Promise<ExitMatch | null> {
  const votesArr = Object.values(votes).map((v) => v.action);
  for (const branch of branches) {
    if (branch.action) {
      if (!policySatisfied(votes, ctx.assigneeCount, branch)) continue;
    }
    if (branch.expression && branch.expression.trim()) {
      const r = await evaluator.evaluate(branch.expression, {
        ...ctx.variables,
        [`decision_${ctx.stageId}`]: null,
        votes: votesArr,
        assigneeCount: ctx.assigneeCount,
      });
      if (!r.ok || !r.value) continue;
    }
    return { branch, action: branch.action };
  }
  return null;
}
