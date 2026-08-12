/**
 * WorkflowHelpers — shared utilities for the workflow engine, event plugins
 * and sandbox. Single source of truth for identifier quoting, id generation,
 * tenant schema resolution and workflow action logging.
 */
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { registerExpressionFunctions, type ExpressionFunction } from '@sails/shared';

/** Max size of a tenant BYOC script, in bytes (sandbox + API validation). */
export const MAX_SCRIPT_BYTES = 64 * 1024;

// JSONata is loaded once at module level (module cache after the first call);
// the lazy guard keeps the engine functional if the dependency is missing.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonataLib: ((expr: string) => any) | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('jsonata') as (expr: string) => any;
  } catch {
    return null;
  }
})();

/** Evaluate a JSONata expression against an input. */
export async function evaluateJsonata(
  expression: string,
  input: any,
  extraFunctions?: Record<string, ExpressionFunction>,
): Promise<{ ok: boolean; value?: any; error?: string }> {
  if (!jsonataLib) {
    return { ok: false, error: 'JSONata engine is not available — add the jsonata dependency to sails-core' };
  }
  try {
    const expressionFn = jsonataLib(expression);
    // First-party function library (date/time formulas etc.) — shared with the
    // console so the editor's Test runner produces identical results.
    registerExpressionFunctions(expressionFn, extraFunctions);
    const value = await expressionFn.evaluate(input);
    return { ok: true, value };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/** Quote a Postgres identifier (table/schema/column) safely. */
export function quoteIdent(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

/** Time-ordered prefixed id (wfa_/wft_/wf_…), unique within a process. */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** tenantId → schemaName (core lookup). */
export async function resolveTenantSchema(tenantId: string): Promise<string | null> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { schemaName: true } });
  return tenant?.schemaName || null;
}

/** Insert a row into the tenant's wf_action_log. */
export async function logWfAction(
  tenantSchema: string,
  instanceId: string,
  stepId: string | null,
  action: string,
  actorId: string | null,
  detail: Record<string, any>,
): Promise<void> {
  const s = quoteIdent(tenantSchema);
  await pool.query(
    `INSERT INTO ${s}.wf_action_log (id, instance_id, step_id, action, actor_id, detail) VALUES ($1, $2, $3, $4, $5, $6)`,
    [genId('wfa'), instanceId, stepId, action, actorId, JSON.stringify(detail)],
  );
}
