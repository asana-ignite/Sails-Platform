/**
 * WorkflowEngine — starts and advances version-pinned workflow instances.
 *
 * Definitions live in core (WorkflowDefinition + immutable WorkflowVersion
 * snapshots). Runtime state lives in the tenant schema (wf_instance etc.)
 * and is written through the shared pg pool with the tenant's search_path.
 *
 * Version pinning: startInstance() freezes `version_id` to the definition's
 * current published WorkflowVersion. advanceInstance() reads the DAG from
 * that snapshot — never from the live draft — so activating a new version
 * never alters in-flight instances.
 */
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { workflowEventRegistry } from '@/core/registry/WorkflowEventRegistry';
import { WorkflowEventContext } from '@/core/registry/WorkflowEventPlugin';
import { evaluateJsonata, genId, logWfAction, quoteIdent, resolveTenantSchema } from './WorkflowHelpers';

export interface WorkflowInstanceInput {
  defId: string;
  payload?: Record<string, any>;
}

/** The record that triggered the workflow (Record Trigger hook). */
export interface RecordTriggerInfo {
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  values: Record<string, any>;
  oldValues?: Record<string, any>;
}

export interface WorkflowStartResult {
  instanceId: string;
  versionId: string | null;
  defName: string;
  state: string;
}

/** Ensure the tenant workflow runtime tables exist (idempotent). */
async function ensureRuntimeTables(schema: string): Promise<void> {
  const wf = quoteIdent(schema);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${wf}.wf_instance (
      id            text PRIMARY KEY,
      def_id        text NOT NULL,
      version_id    text,
      state         text NOT NULL DEFAULT 'running',
      current_step_ids jsonb NOT NULL DEFAULT '[]',
      vars          jsonb NOT NULL DEFAULT '{}',
      created_by    text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ${wf}.wf_task (
      id            text PRIMARY KEY,
      instance_id   text NOT NULL,
      step_id       text NOT NULL,
      status        text NOT NULL DEFAULT 'pending',
      assignee_type text,
      assignee_id   text,
      due_at        timestamptz,
      decided_by    text,
      decision      jsonb,
      decided_at    timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ${wf}.wf_action_log (
      id          text PRIMARY KEY,
      instance_id text NOT NULL,
      step_id     text,
      action      text NOT NULL,
      actor_id    text,
      detail      jsonb,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wf_task_instance_idx ON ${wf}.wf_task (instance_id);
    CREATE INDEX IF NOT EXISTS wf_task_status_idx ON ${wf}.wf_task (status);
    CREATE INDEX IF NOT EXISTS wf_action_log_instance_idx ON ${wf}.wf_action_log (instance_id);
    CREATE TABLE IF NOT EXISTS ${wf}.wf_notification (
      id          text PRIMARY KEY,
      instance_id text,
      user_id     text NOT NULL,
      source      text NOT NULL DEFAULT 'workflow',
      subject     text,
      body        text,
      status      text NOT NULL DEFAULT 'delivered',
      created_at  timestamptz NOT NULL DEFAULT now(),
      read_at     timestamptz
    );
    CREATE INDEX IF NOT EXISTS wf_notification_user_idx ON ${wf}.wf_notification (user_id, status);
    CREATE INDEX IF NOT EXISTS wf_notification_instance_idx ON ${wf}.wf_notification (instance_id);
  `);
}

/**
 * Fire the Workflow Events of a stage through the WorkflowEventRegistry
 * (Option A). Events run in declaration order; each plugin's output is merged
 * into the instance variables. stage_enter failures abort the operation —
 * stage_exit failures are logged and tolerated.
 *
 * `tableName` is threaded from the caller when known (avoids a redundant
 * table lookup); when omitted it falls back to resolving dag.tableId.
 */
export async function fireStageEvents(
  tenantId: string,
  tenantSchema: string,
  instanceId: string,
  dag: any,
  stageId: string | null,
  timing: 'stage_enter' | 'stage_exit',
  actorId: string | null,
  vars: Record<string, any>,
  recordInfo: RecordTriggerInfo | null = null,
  tableName: string | null | undefined = undefined,
): Promise<Record<string, any>> {
  const stage = stageId
    ? (dag?.stages || []).find((s: any) => s.id === stageId)
    : (dag?.stages || [])[0] || null;
  if (!stage?.events?.length) return vars;

  if (tableName === undefined && dag?.tableId) {
    const table = await db.tableDefinition
      .findUnique({ where: { id: dag.tableId }, select: { tableName: true } })
      .catch(() => null);
    tableName = table?.tableName || null;
  }

  const wf = quoteIdent(tenantSchema);
  const logEventFailure = async (event: any, error: string) => {
    await logWfAction(tenantSchema, instanceId, stage.id, 'event:failed', actorId || null, {
      event: event?.type,
      error,
    }).catch(() => undefined);
  };

  let currentVars = { ...vars };
  for (const event of stage.events) {
    if (!event?.type) continue;
    let plugin;
    try {
      plugin = workflowEventRegistry.getPlugin(event.type);
    } catch {
      continue;
    }
    const ctx: WorkflowEventContext = {
      tenantId,
      instanceId,
      stageId: stage.id,
      tableName: tableName || null,
      recordId: recordInfo?.recordId || null,
      record: recordInfo
        ? { id: recordInfo.recordId, values: recordInfo.values, oldValues: recordInfo.oldValues }
        : null,
      operation: recordInfo?.operation || null,
      variables: currentVars,
      variableDefs: dag?.variables || [],
      session: { userId: actorId || '', teamId: null },
      timing,
      eventConfig: event.config || {},
    };
    try {
      const result = await plugin.execute(ctx);
      if (result.output) currentVars = { ...currentVars, ...result.output };
      // Output Mapping: transform the event's stored result into workflow
      // variables with JSONata (e.g. "$[0].name" over a collection result).
      const outputMapping = event.config?.outputMapping as
        | { sourcePath?: string; targetVariable?: string; defaultValue?: any }[]
        | undefined;
      if (Array.isArray(outputMapping) && outputMapping.length > 0) {
        const source = currentVars[event.config?.storeToVariable as string];
        for (const m of outputMapping) {
          if (!m?.sourcePath || !m?.targetVariable) continue;
          const r = await evaluateJsonata(m.sourcePath, source);
          let value = r.ok ? r.value : undefined;
          if ((value === undefined || value === null || value === '') && m.defaultValue !== undefined) {
            value = m.defaultValue;
          }
          if (r.ok || m.defaultValue !== undefined) currentVars[m.targetVariable] = value;
        }
      }
      if (!result.success) {
        await logEventFailure(event, result.error || 'unknown error');
        if (timing === 'stage_enter') {
          throw new Error(`Workflow event '${event.type}' failed: ${result.error}`);
        }
      }
    } catch (error: any) {
      await logEventFailure(event, error?.message || String(error));
      if (timing === 'stage_enter') throw error;
    }
  }

  await pool.query(
    `UPDATE ${wf}.wf_instance SET vars = $1, updated_at = now() WHERE id = $2`,
    [JSON.stringify(currentVars), instanceId],
  );
  return currentVars;
}

/**
 * Start a new workflow instance pinned to the definition's current published
 * version. When no published version exists yet, falls back to a live draft
 * (version_id NULL) — callers should treat this as "unpublished definition".
 *
 * `recordInfo` is supplied by the Record Trigger hook so stage_enter events
 * (scripts, expressions) can read the triggering record via ctx.record.
 */
export async function startInstance(
  tenantId: string,
  input: WorkflowInstanceInput,
  actorId?: string,
  recordInfo: RecordTriggerInfo | null = null,
): Promise<WorkflowStartResult> {
  const schema = await resolveTenantSchema(tenantId);
  if (!schema) throw new Error('Tenant schema not found');

  const def = await db.workflowDefinition.findFirst({
    where: { id: input.defId, tenantId },
    include: { table: { select: { tableName: true } } },
  });
  if (!def) throw new Error('Workflow definition not found or access denied');
  if (def.status === 'deactivated') throw new Error('Workflow is deactivated — no new instances can be started');
  if (def.status !== 'active' || !def.publishedConfig) {
    throw new Error('Workflow has no published version — activate it before starting instances');
  }

  // Pin to the newest published version for this definition.
  const version = await db.workflowVersion.findFirst({
    where: { defId: def.id },
    orderBy: { version: 'desc' },
  });

  await ensureRuntimeTables(schema);

  const wf = quoteIdent(schema);
  const instanceId = genId('wf');
  const vars = { ...(input.payload || {}) };

  await pool.query(
    `INSERT INTO ${wf}.wf_instance (id, def_id, version_id, state, current_step_ids, vars, created_by)
     VALUES ($1, $2, $3, 'running', '[]', $4, $5)`,
    [instanceId, def.id, version?.id || null, JSON.stringify(vars), actorId || null],
  );

  await logWfAction(schema, instanceId, null, 'started', actorId || null, {
    defId: def.id,
    version: version?.version || null,
  });

  // Fire stage_enter events of the first stage (Workflow Event Plug-Ins).
  const dag = version?.config || def.publishedConfig || def.config || null;
  try {
    await fireStageEvents(
      tenantId, schema, instanceId, dag, null, 'stage_enter', actorId || null, vars, recordInfo, def.table?.tableName || null,
    );
  } catch (error: any) {
    await pool.query(
      `UPDATE ${wf}.wf_instance SET state = 'failed', updated_at = now() WHERE id = $1`,
      [instanceId],
    );
    throw error;
  }

  return {
    instanceId,
    versionId: version?.id || null,
    defName: def.name,
    state: 'running',
  };
}

/**
 * Advance an instance using its pinned version snapshot. The DAG (stages,
 * branches, events, variables) is read from the frozen WorkflowVersion row.
 */
export async function advanceInstance(
  tenantId: string,
  instanceId: string,
  decision?: { stepId: string; outcome: 'approved' | 'rejected'; actorId?: string; comment?: string },
): Promise<{ state: string }> {
  const schema = await resolveTenantSchema(tenantId);
  if (!schema) throw new Error('Tenant schema not found');

  const wf = quoteIdent(schema);
  const res = await pool.query(
    `SELECT id, def_id, version_id, state, vars FROM ${wf}.wf_instance WHERE id = $1`,
    [instanceId],
  );
  const instance = res.rows[0];
  if (!instance) throw new Error('Instance not found');
  if (instance.state === 'completed') return { state: instance.state };

  // Frozen DAG from the version snapshot (or live config fallback for NULL).
  let dag: any = null;
  if (instance.version_id) {
    const version = await db.workflowVersion.findUnique({
      where: { id: instance.version_id },
    });
    dag = version?.config || null;
  }
  if (!dag) {
    const def = await db.workflowDefinition.findUnique({ where: { id: instance.def_id } });
    dag = def?.publishedConfig || def?.config || null;
  }
  if (!dag) throw new Error('No workflow configuration available for this instance');

  if (decision) {
    await pool.query(
      `UPDATE ${wf}.wf_task SET status = $1, decided_by = $2, decision = $3, decided_at = now()
       WHERE instance_id = $4 AND step_id = $5 AND status = 'pending'`,
      [decision.outcome, decision.actorId || null, JSON.stringify({ comment: decision.comment || null }), instanceId, decision.stepId],
    );
    await logWfAction(schema, instanceId, decision.stepId, `decided:${decision.outcome}`, decision.actorId || null, {
      comment: decision.comment || null,
    });
  }

  // Placeholder progression: mark completed when every task is decided.
  const pending = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${wf}.wf_task WHERE instance_id = $1 AND status = 'pending'`,
    [instanceId],
  );
  const remaining = pending.rows[0]?.n || 0;
  if (remaining === 0) {
    // Fire stage_exit events for the stage whose tasks were just decided
    // (Workflow Event Plug-Ins). Failures are logged and tolerated.
    if (decision?.stepId) {
      await fireStageEvents(tenantId, schema, instanceId, dag, decision.stepId, 'stage_exit', decision.actorId || null, instance.vars || {});
    }
    await pool.query(
      `UPDATE ${wf}.wf_instance SET state = 'completed', updated_at = now() WHERE id = $1`,
      [instanceId],
    );
    await logWfAction(schema, instanceId, null, 'completed', null, {});
    return { state: 'completed' };
  }

  return { state: 'running' };
}

/** List running (non-completed) instances for a definition across the tenant. */
export async function countInstancesForDefinition(tenantId: string, defId: string): Promise<number> {
  const schema = await resolveTenantSchema(tenantId);
  if (!schema) return 0;
  try {
    const wf = quoteIdent(schema);
    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${wf}.wf_instance WHERE def_id = $1 AND state <> 'completed'`,
      [defId],
    );
    return res.rows[0]?.n || 0;
  } catch {
    return 0; // table not created yet
  }
}

export const WorkflowEngine = { startInstance, advanceInstance, countInstancesForDefinition, fireStageEvents };
export default WorkflowEngine;
