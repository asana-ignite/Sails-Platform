/**
 * WorkflowTriggers — record-triggered workflow starts.
 *
 * QueryLayer write operations (create/update/delete/upsert) call
 * triggerBoundWorkflows() fire-and-forget. It resolves ACTIVE workflow
 * definitions bound to the table whose triggerOn matches the operation and
 * starts a version-pinned instance with the triggering record's values
 * (ctx.record / ctx.operation flow to stage events).
 *
 * startInstance is imported dynamically so the heavy WorkflowEngine +
 * plugin-init graph only loads when a workflow actually fires — record writes
 * never pay that cost, and no import cycle is introduced.
 *
 * Safety: the whole path is try/catch'd — a workflow hiccup can never fail
 * the user's record write (fire-and-forget semantics).
 */
import { db } from '@/lib/db';
import { SYSTEM_PROTECTED_COLUMNS } from '@sails/shared';

export interface RecordTriggerArgs {
  tenantId: string;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  values?: Record<string, any>;
  oldValues?: Record<string, any>;
  actorId?: string | null;
}

const OP_MATCHES: Record<'create' | 'update' | 'delete', string[]> = {
  create: ['insert', 'insert_or_update'],
  update: ['update', 'insert_or_update'],
  delete: ['delete'],
};

/**
 * Normalize the triggerOn array exactly like Workflow Studio's triggerOpOf:
 *   delete wins → delete; insert_or_update or (create+update) → insert_or_update;
 *   insert/create → insert; update → update; empty/unknown → insert_or_update.
 * This keeps the hook's semantics identical to what the Studio displays —
 * including the empty-array fallback shown as "Inserted Or Updated".
 */
function normalizedTriggerOp(triggerOn: string[] | undefined | null): string {
  const list = Array.isArray(triggerOn) ? triggerOn : [];
  const has = (t: string) => list.includes(t);
  if (has('insert_or_update') || (has('create') && has('update'))) return 'insert_or_update';
  if (has('delete')) return 'delete';
  if (has('insert') || has('create')) return 'insert';
  if (has('update')) return 'update';
  return 'insert_or_update';
}

function triggerMatches(triggerOn: string[] | undefined | null, operation: 'create' | 'update' | 'delete'): boolean {
  const op = normalizedTriggerOp(triggerOn);
  return OP_MATCHES[operation].includes(op);
}

/** No-op updates (identical data columns) should not fire workflows. */
function valuesEqualForTrigger(values?: Record<string, any>, oldValues?: Record<string, any>): boolean {
  if (!values || !oldValues) return false;
  const strip = (o: Record<string, any>): Record<string, any> => {
    const c: Record<string, any> = {};
    for (const [k, v] of Object.entries(o)) {
      if (!SYSTEM_PROTECTED_COLUMNS.includes(k)) c[k] = v;
    }
    return c;
  };
  return JSON.stringify(strip(values)) === JSON.stringify(strip(oldValues));
}

/**
 * Evaluate a definition's triggerCondition (QueryStudio FilterGroups) against
 * the triggering record — mirrors the Record Event plugin's filter semantics
 * (RLS-scoped, requestor/record macros resolved via the workflow context).
 */
async function evaluateTriggerCondition(args: RecordTriggerArgs, groups: any[]): Promise<boolean> {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  if (groups.every((g) => !(g.rules || []).length)) return true;
  try {
    const { resolveTenantSchema } = await import('./WorkflowHelpers');
    const { resolveTableMeta, serializeRecordFilters, buildWorkflowCtx } = await import('./WorkflowEventPlugins');
    const { preprocessFilterGroups } = await import('./filterPreprocess');
    const { QueryLayer } = await import('./QueryLayer');
    const { pool } = await import('@/lib/knex');

    const schema = await resolveTenantSchema(args.tenantId);
    if (!schema) return false;
    const meta = await resolveTableMeta(args.tenantId, args.tableName);
    if (!meta) return false;

    let userRole = 'rls_user';
    if (args.actorId) {
      const u = await db.user.findUnique({
        where: { id: args.actorId },
        select: { role: true },
      }).catch(() => null);
      if (u?.role) userRole = u.role;
    }

    const ses: any = {
      userId: args.actorId || '',
      tenantId: args.tenantId,
      role: userRole,
      email: '',
      teams: [],
    };
    const filterGroups = serializeRecordFilters(groups, meta.table.fields);
    const triggerCtx: any = {
      tenantId: args.tenantId,
      instanceId: null,
      stageId: null,
      tableName: args.tableName,
      recordId: args.recordId,
      record: { id: args.recordId, values: args.values || {} },
      operation: args.operation,
      variables: {},
      session: { userId: args.actorId || '', teamId: null },
      timing: 'stage_enter',
      eventConfig: {},
    };
    const workflowCtx = await buildWorkflowCtx(triggerCtx, schema, filterGroups, false);
    await preprocessFilterGroups({
      session: ses,
      tableName: args.tableName,
      tableFields: meta.table.fields,
      filterGroups,
      workflowCtx: workflowCtx || undefined,
    });

    const rows = await QueryLayer.listRecords(pool, schema, args.tableName, {
      filters: { 'id:eq': args.recordId },
      filterGroups,
      limit: 1,
      page: 1,
      validFields: meta.validFields,
      textFields: meta.textFields,
      jsonbFields: meta.jsonbFields,
      ctx: ses,
    });
    return (rows.rows || []).length > 0;
  } catch (err: any) {
    console.error('[WorkflowTriggers] trigger condition evaluation failed:', err?.message || err);
    return false;
  }
}

/**
 * Resolve active workflows bound to the table and start an instance for each
 * matching triggerOn + triggerCondition. Fire-and-forget — never throws.
 */
export async function triggerBoundWorkflows(args: RecordTriggerArgs): Promise<void> {
  try {
    if (args.operation === 'update' && valuesEqualForTrigger(args.values, args.oldValues)) return;

    const tableDef = await db.tableDefinition.findUnique({
      where: { tenantId_tableName: { tenantId: args.tenantId, tableName: args.tableName } },
      select: { id: true },
    });
    if (!tableDef) return;

    const defs = await db.workflowDefinition.findMany({
      where: {
        tenantId: args.tenantId,
        tableId: tableDef.id,
        status: { not: 'deactivated' },
        publishedConfig: { not: null as any },
      },
      select: { id: true, config: true, publishedConfig: true },
    });
    if (defs.length === 0) return;

    const matches = defs.filter((d) => {
      const cfg = (d.publishedConfig || d.config || {}) as any;
      return triggerMatches(cfg.triggerOn, args.operation);
    });
    if (matches.length === 0) return;

    const { startInstance } = await import('./WorkflowEngine');
    for (const def of matches) {
      const cfg = (def.publishedConfig || def.config || {}) as any;
      const conditionOk = await evaluateTriggerCondition(args, cfg.triggerCondition);
      if (!conditionOk) continue;

      startInstance(
        args.tenantId,
        { defId: def.id },
        args.actorId ?? undefined,
        {
          operation: args.operation,
          recordId: args.recordId,
          values: args.values || {},
          oldValues: args.oldValues,
        },
      ).catch((err: any) => console.error('[WorkflowTriggers] startInstance failed:', err?.message || err));
    }
  } catch (err: any) {
    console.error('[WorkflowTriggers] failed to start workflows:', err?.message || err);
  }
}
