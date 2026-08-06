/**
 * WorkflowHelpers — shared utilities for the workflow engine, event plugins
 * and sandbox. Single source of truth for identifier quoting, id generation,
 * tenant schema resolution and workflow action logging.
 */
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';

/** Max size of a tenant BYOC script, in bytes (sandbox + API validation). */
export const MAX_SCRIPT_BYTES = 64 * 1024;

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
