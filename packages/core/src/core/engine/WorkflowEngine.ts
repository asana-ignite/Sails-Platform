/**
 * WorkflowEngine — starts and advances version-pinned workflow instances.
 *
 * Definitions live in core (WorkflowDefinition + immutable WorkflowVersion
 * snapshots). Runtime state lives in the tenant schema (wf_instance etc.)
 * and is written through the shared pg pool with the tenant's search_path.
 *
 * Version pinning: startInstance() freezes `version_id` to the definition's
 * current published WorkflowVersion. proceedInstance() reads the DAG from
 * that snapshot — never from the live draft — so activating a new version
 * never alters in-flight instances.
 */
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { workflowEventRegistry } from '@sails/plugin-sdk';
import type { WorkflowEventContext } from '@sails/plugin-sdk';
import { evaluateJsonata, genId, logWfAction, quoteIdent, resolveTenantSchema } from './WorkflowHelpers';
import { evaluateExitConditions, majorityAction, type ExitEvaluator, type VoteLookup, type VotePolicyBranch } from './exitConditions';
import { evaluateFilterGroups } from '@sails/shared';
import '@/core/plugins/init'; // side-effect: registers event plugins + starts the scheduler (bare import — never tree-shaken)

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
      trigger       text,
      record_id     text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE ${wf}.wf_instance ADD COLUMN IF NOT EXISTS trigger text;
    ALTER TABLE ${wf}.wf_instance ADD COLUMN IF NOT EXISTS record_id text;
    CREATE TABLE IF NOT EXISTS ${wf}.wf_task (
      id            text PRIMARY KEY,
      instance_id   text NOT NULL,
      step_id       text NOT NULL,
      status        text NOT NULL DEFAULT 'pending',
      assignee_type text,
      assignee_id   text,
      assignee_users jsonb,
      decisions     jsonb,
      actions       jsonb,
      due_at        timestamptz,
      decided_by    text,
      decision      jsonb,
      decided_at    timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE ${wf}.wf_task ADD COLUMN IF NOT EXISTS assignee_users jsonb;
    ALTER TABLE ${wf}.wf_task ADD COLUMN IF NOT EXISTS decisions jsonb;
    ALTER TABLE ${wf}.wf_task ADD COLUMN IF NOT EXISTS actions jsonb;
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
    CREATE TABLE IF NOT EXISTS ${wf}.wf_execution_log (
      id          text PRIMARY KEY,
      instance_id text NOT NULL UNIQUE,
      def_id      text,
      version_id  text,
      def_name    text,
      status      text NOT NULL,
      started_at  timestamptz NOT NULL,
      ended_at    timestamptz NOT NULL,
      duration_ms bigint NOT NULL,
      error       text,
      stage_id    text,
      event_type  text,
      trigger     text,
      actor_id    text,
      record_id   text,
      events      jsonb,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS wf_execution_log_def_idx ON ${wf}.wf_execution_log (def_id, status);
    CREATE INDEX IF NOT EXISTS wf_execution_log_status_idx ON ${wf}.wf_execution_log (status, ended_at DESC);
    DO $$ BEGIN
      ALTER TABLE ${wf}.wf_execution_log ADD CONSTRAINT wf_execution_log_instance_fk
        FOREIGN KEY (instance_id) REFERENCES ${wf}.wf_instance (id) ON DELETE CASCADE NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE ${wf}.wf_task ADD CONSTRAINT wf_task_instance_fk
        FOREIGN KEY (instance_id) REFERENCES ${wf}.wf_instance (id) ON DELETE CASCADE NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      ALTER TABLE ${wf}.wf_action_log ADD CONSTRAINT wf_action_log_instance_fk
        FOREIGN KEY (instance_id) REFERENCES ${wf}.wf_instance (id) ON DELETE CASCADE NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
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
 * `onEvent` (when provided) receives a per-event execution summary used by
 * the Workflow Execution Log.
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
  onEvent?: (summary: WorkflowEventExec) => void,
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
    // An event's timing defaults to 'stage_enter'. Stage exit only runs events explicitly declared as stage_exit.
    const eventTiming = event.timing || 'stage_enter';
    if (eventTiming !== timing) continue;

    let plugin;
    try {
      plugin = workflowEventRegistry.getPlugin(event.type);
    } catch {
      continue;
    }
    const t0 = Date.now();
    const summary: WorkflowEventExec = { stageId: stage.id, type: event.type, timing, success: true, durationMs: 0 };
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
    // Workflow-caused writes must never re-trigger record workflows (loop guard).
    (ctx as any).suppressRecordTriggers = true;
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
        summary.success = false;
        summary.error = result.error || 'unknown error';
        await logEventFailure(event, result.error || 'unknown error');
        throw new Error(`Workflow event '${event.type}' failed: ${result.error}`);
      }

      // Incrementally persist variables to DB so intermediate results are safe
      await pool.query(
        `UPDATE ${wf}.wf_instance SET vars = $1, updated_at = now() WHERE id = $2`,
        [JSON.stringify(currentVars), instanceId],
      );
    } catch (error: any) {
      summary.success = false;
      summary.error = error?.message || String(error);
      await logEventFailure(event, error?.message || String(error));
      throw error;
    } finally {
      summary.durationMs = Date.now() - t0;
      onEvent?.(summary);
    }
  }

  return currentVars;
}

/**
 * Per-event execution summary captured during fireStageEvents for the
 * Workflow Execution Log.
 */
export interface WorkflowEventExec {
  stageId: string;
  type: string;
  timing: 'stage_enter' | 'stage_exit';
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Write a terminal entry to the tenant's wf_execution_log — ONE row per
 * workflow instance, inserted asynchronously (fire-and-forget) AFTER the
 * instance reaches its terminal state. Start time is read back from
 * wf_instance.created_at, so there is never a start-row-then-update pattern:
 * the log row is created once, complete with start/end/duration/status/error.
 */
export async function writeExecutionLog(
  tenantSchema: string,
  instanceId: string,
  input: {
    status: 'success' | 'failed';
    error?: string | null;
    stageId?: string | null;
    eventType?: string | null;
    events?: WorkflowEventExec[];
  },
): Promise<void> {
  const s = quoteIdent(tenantSchema);
  const res = await pool.query(
    `SELECT id, def_id, version_id, created_at, created_by, trigger, record_id
     FROM ${s}.wf_instance WHERE id = $1`,
    [instanceId],
  );
  const inst = res.rows[0];
  if (!inst) return;

  let defName: string | null = null;
  if (inst.def_id) {
    const def = await db.workflowDefinition
      .findUnique({ where: { id: inst.def_id }, select: { name: true } })
      .catch(() => null);
    defName = def?.name || null;
  }

  const startedAt = new Date(inst.created_at as string);
  const endedAt = new Date();
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());

  await pool.query(
    `INSERT INTO ${s}.wf_execution_log
       (id, instance_id, def_id, version_id, def_name, status, started_at, ended_at, duration_ms,
        error, stage_id, event_type, trigger, actor_id, record_id, events)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (instance_id) DO NOTHING`,
    [
      genId('wfx'), instanceId, inst.def_id, inst.version_id, defName, input.status,
      startedAt, endedAt, String(durationMs),
      input.error ?? null, input.stageId ?? null, input.eventType ?? null,
      inst.trigger ?? null, inst.created_by ?? null, inst.record_id ?? null,
      input.events && input.events.length > 0 ? JSON.stringify(input.events) : null,
    ],
  );
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
  if (!def.publishedConfig) {
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
    `INSERT INTO ${wf}.wf_instance (id, def_id, version_id, state, current_step_ids, vars, created_by, trigger, record_id)
     VALUES ($1, $2, $3, 'running', '[]', $4, $5, $6, $7)`,
    [instanceId, def.id, version?.id || null, JSON.stringify(vars), actorId || null,
      recordInfo?.operation || 'manual', recordInfo?.recordId || null],
  );

  await logWfAction(schema, instanceId, null, 'started', actorId || null, {
    defId: def.id,
    version: version?.version || null,
  });

  // Fire stage_enter events of the first stage (Workflow Event Plug-Ins).
  const dag = version?.config || def.publishedConfig || def.config || null;
  const eventLog: WorkflowEventExec[] = [];
  try {
    await fireStageEvents(
      tenantId, schema, instanceId, dag, null, 'stage_enter', actorId || null, vars, recordInfo, def.table?.tableName || null,
      (summary) => eventLog.push(summary),
    );
  } catch (error: any) {
    await pool.query(
      `UPDATE ${wf}.wf_instance SET state = 'failed', updated_at = now() WHERE id = $1`,
      [instanceId],
    );
    const failed = eventLog.find((e) => !e.success);
    void writeExecutionLog(schema, instanceId, {
      status: 'failed',
      error: error?.message || String(error),
      stageId: failed?.stageId || null,
      eventType: failed?.type || null,
      events: eventLog,
    }).catch(() => undefined);
    throw error;
  }

  // Kick the progression loop: if the first stage has no pending tasks (no
  // approval events), the instance completes immediately — otherwise it waits
  // for the scheduler / assignee decisions.
  const proceed = await proceedInstance(tenantId, instanceId).catch((error: any) => {
    console.error(`[WF-ENGINE] post-start progression failed for ${instanceId}:`, error?.message || error);
    return null;
  });

  return {
    instanceId,
    versionId: version?.id || null,
    defName: def.name,
    state: proceed?.state || 'running',
  };
}

/**
 * Proceed a running workflow instance as far as it can go right now.
 *
 * Drives the DAG traversal: records an optional assignee decision, checks the
 * current stage's pending tasks and, when none remain, routes through the
 * stage's branches to the next stage (firing stage_exit / stage_enter events)
 * or completes the instance. Stage transitions use compare-and-set updates on
 * wf_instance so concurrent decide/scheduler calls can never double-fire
 * stage events.
 *
 * Failures mark the instance 'failed' and are recorded in wf_execution_log
 * (async, fire-and-forget) before the error is re-thrown to the caller.
 */
export async function proceedInstance(
  tenantId: string,
  instanceId: string,
  decision?: { stepId: string; outcome: string; actorId?: string; comment?: string },
): Promise<{ state: string }> {
  const schema = await resolveTenantSchema(tenantId);
  if (!schema) throw new Error('Tenant schema not found');

  const wf = quoteIdent(schema);
  const res = await pool.query(
    `SELECT id, def_id, version_id, state, vars, current_step_ids, record_id, trigger FROM ${wf}.wf_instance WHERE id = $1`,
    [instanceId],
  );
  const instance = res.rows[0];
  if (!instance) throw new Error('Instance not found');
  if (instance.state === 'completed' || instance.state === 'failed') return { state: instance.state };

  const eventLog: WorkflowEventExec[] = [];
  try {
    return await proceedCore(tenantId, schema, wf, instance, decision, eventLog);
  } catch (error: any) {
    // Only mark failed while the instance is still running — a concurrent
    // flow may have completed it already (then no failed log is written).
    const mark = await pool
      .query(
        `UPDATE ${wf}.wf_instance SET state = 'failed', updated_at = now() WHERE id = $1 AND state = 'running'`,
        [instanceId],
      )
      .catch(() => ({ rowCount: 0 }));
    if ((mark.rowCount || 0) > 0) {
      const failed = eventLog.find((e) => !e.success);
      void writeExecutionLog(schema, instanceId, {
        status: 'failed',
        error: error?.message || String(error),
        stageId: failed?.stageId || null,
        eventType: failed?.type || null,
        events: eventLog,
      }).catch(() => undefined);
    }
    throw error;
  }
}

/** Backwards-compatible alias — the decide flow and scheduler use proceedInstance. */
export const advanceInstance = proceedInstance;

/** Max stage transitions per proceedInstance call (guards cycles / bad configs). */
const MAX_STAGE_HOPS = 20;

/**
 * Exit-condition evaluator: Condition-builder groups via the shared filter
 * evaluator, with the AST-cached JSONata engine for the Expression f(x) RHS
 * source (a failing expression never matches — same rule as the old gate).
 */
const exitEvaluator: ExitEvaluator = {
  evaluateGroups: (groups, evalCtx) => evaluateFilterGroups(groups, evalCtx),
  evaluateExpression: async (expr, input) => {
    const r = await evaluateJsonata(expr, input);
    return r.ok ? r.value : undefined;
  },
};

/** The workflow's root record for Condition-builder field rules (trigger
 *  values + id live in the instance vars, exactly like ctx.record). */
function exitRecordOf(vars: Record<string, any>): Record<string, any> {
  return { ...(vars.values || {}), id: vars.recordId, ...(vars.oldValues ? { oldValues: vars.oldValues } : {}) };
}

/** Enrich the deciding user with role/email so @user.* / @me macros resolve
 *  in Condition-builder exit gates — one indexed lookup, only when the stage
 *  actually carries gates (id-only otherwise). */
async function exitUserOf(
  actorId: string,
  hasGates: boolean,
): Promise<{ id: string; role?: string; email?: string } | undefined> {
  if (!actorId) return undefined;
  if (!hasGates) return { id: actorId };
  try {
    const u = await db.user.findUnique({ where: { id: actorId }, select: { role: true, email: true } });
    return u ? { id: actorId, role: u.role || undefined, email: u.email || undefined } : { id: actorId };
  } catch {
    return { id: actorId };
  }
}

/**
 * Resolve the root table's field map (id → fieldName) for Condition-builder
 * exit gates — only when any exit line of the DAG carries one (legacy
 * workflows without groups skip the metadata lookup entirely). Null when the
 * table can't be resolved — rules then fall back to fieldName matching.
 */
async function resolveExitCondFields(tenantId: string, dag: any): Promise<{ id: string; fieldName: string }[] | null> {
  const hasGroups = (dag?.stages || []).some((st: any) =>
    (st?.branches || []).some((b: any) =>
      Array.isArray(b?.conditionGroups) && b.conditionGroups.some((g: any) => (g?.rules || []).length > 0)));
  if (!hasGroups) return null;
  const tableId = dag?.tableId;
  if (!tableId) return null;
  const td = await db.tableDefinition.findFirst({ where: { tenantId, id: tableId }, include: { fields: true } });
  if (!td) return null;
  return (td.fields || []).map((f: any) => ({ id: f.id, fieldName: f.fieldName ?? f.id }));
}

/** Load the pinned-version DAG for an instance (or live config fallback for NULL). */
async function loadDag(instance: any): Promise<any> {
  let dag: any = null;
  if (instance.version_id) {
    const version = await db.workflowVersion.findUnique({ where: { id: instance.version_id } });
    dag = version?.config || null;
  }
  if (!dag) {
    const def = await db.workflowDefinition.findUnique({ where: { id: instance.def_id } });
    dag = def?.publishedConfig || def?.config || null;
  }
  return dag;
}

/**
 * Core progression loop for proceedInstance. The current stage is the last
 * entry of wf_instance.current_step_ids; an empty list means the FIRST stage
 * (its stage_enter events were already fired by startInstance).
 */
async function proceedCore(
  tenantId: string,
  schema: string,
  wf: string,
  instance: any,
  decision?: { stepId: string; outcome: string; actorId?: string; comment?: string },
  eventLog: WorkflowEventExec[] = [],
): Promise<{ state: string }> {
  const instanceId = instance.id;
  const dag = await loadDag(instance);
  if (!dag) throw new Error('No workflow configuration available for this instance');

  // Root-table field map for Condition-builder exit gates (null when the DAG
  // has none — legacy workflows skip the metadata lookup).
  const exitFields = await resolveExitCondFields(tenantId, dag);

  const stages: any[] = dag?.stages || [];
  let currentIds: string[] = Array.isArray(instance.current_step_ids) ? instance.current_step_ids : [];
  let stageId = currentIds.length ? currentIds[currentIds.length - 1] : stages[0]?.id || null;
  let vars: Record<string, any> = { ...(instance.vars || {}) };

  // Reconstruct triggering record context if available on the instance
  const recordInfo: RecordTriggerInfo | null = instance.record_id
    ? {
        recordId: instance.record_id,
        operation: (instance.trigger as any) || 'update',
        values: vars.record || vars.values || undefined,
        oldValues: vars.oldRecord || vars.oldValues || undefined,
      }
    : null;

  for (let hops = 0; hops < MAX_STAGE_HOPS; hops++) {
    const stage = stages.find((st: any) => st.id === stageId) || null;
    if (!stage) throw new Error(`Stage '${stageId}' not found in the workflow configuration`);

    // 1. Record an assignee's decision for the current stage (if provided).
    if (decision && decision.stepId === stageId) {
      const handled = await recordVote(schema, wf, instance, dag, stage, decision, exitFields);
      if (!handled) return { state: 'running' }; // resolved concurrently elsewhere
    }

    // 2. Pending tasks on the current stage → wait for humans (or the
    //    scheduler's timeout handling, when that lands).
    const pending = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${wf}.wf_task WHERE instance_id = $1 AND step_id = $2 AND status = 'pending'`,
      [instanceId, stageId],
    );
    if ((pending.rows[0]?.n || 0) > 0) return { state: 'running' };

    // 3. No pending tasks → resolve the stage's exit and route onward.
    const exit = await resolveStageExit(schema, wf, instance, dag, stage, exitFields);
    if (!exit) return { state: 'running' }; // no branch matched — scheduler retries

    if (exit.type === 'completed') {
      vars = await fireStageExit(tenantId, schema, instanceId, dag, stage, vars, eventLog, recordInfo);
      const upd = await pool.query(
        `UPDATE ${wf}.wf_instance SET state = 'completed', updated_at = now() WHERE id = $1 AND state = 'running'`,
        [instanceId],
      );
      if ((upd.rowCount || 0) === 0) {
        const reread = await pool.query(`SELECT state FROM ${wf}.wf_instance WHERE id = $1`, [instanceId]);
        return { state: reread.rows[0]?.state || 'running' };
      }
      await logWfAction(schema, instanceId, null, 'completed', null, {});
      void writeExecutionLog(schema, instanceId, { status: 'success', events: eventLog }).catch(() => undefined);
      return { state: 'completed' };
    }

    // 4. Route to the next stage:
    // First, fire current stage's exit events. If an exit event fails, it throws and halts the instance here.
    vars = await fireStageExit(tenantId, schema, instanceId, dag, stage, vars, eventLog, recordInfo);

    // Next, CAS-claim the transition to the next stage.
    const nextStageId = exit.stageId as string;
    const nextIds = [...currentIds, nextStageId];
    const claimed = await pool.query(
      `UPDATE ${wf}.wf_instance SET current_step_ids = $1::jsonb, updated_at = now()
       WHERE id = $2 AND state = 'running' AND current_step_ids = $3::jsonb`,
      [JSON.stringify(nextIds), instanceId, JSON.stringify(currentIds)],
    );
    if ((claimed.rowCount || 0) === 0) {
      const reread = await pool.query(`SELECT state FROM ${wf}.wf_instance WHERE id = $1`, [instanceId]);
      return { state: reread.rows[0]?.state || 'running' };
    }

    // Fire stage_enter events on the newly claimed stage.
    const nextStage = stages.find((st: any) => st.id === nextStageId);
    if (nextStage?.events?.length) {
      vars = await fireStageEvents(
        tenantId, schema, instanceId, dag, nextStageId, 'stage_enter', null, vars,
        recordInfo, undefined, (summary) => eventLog.push(summary),
      );
    }
    await logWfAction(schema, instanceId, nextStageId, `entered:${nextStageId}`, null, {
      fromStage: stageId,
    });
    currentIds = nextIds;
    stageId = nextStageId;
  }

  throw new Error(`Workflow stage transition loop detected after ${MAX_STAGE_HOPS} hops`);
}

/** Fire a stage's stage_exit events (tolerated failures), returning merged vars. */
async function fireStageExit(
  tenantId: string,
  schema: string,
  instanceId: string,
  dag: any,
  stage: any,
  vars: Record<string, any>,
  eventLog: WorkflowEventExec[],
  recordInfo: RecordTriggerInfo | null = null,
): Promise<Record<string, any>> {
  if (!stage?.events?.length) return vars;
  return fireStageEvents(
    tenantId, schema, instanceId, dag, stage.id, 'stage_exit', null, vars,
    recordInfo, undefined, (summary) => eventLog.push(summary),
  );
}

/**
 * Determine where the instance routes after a stage with no pending tasks:
 * the branch a resolved task pinned via matchedBranch, else the first branch
 * whose vote policy + Condition-builder gate pass (fallback branches have no
 * action and no groups, so they always match last). Returns null while the
 * stage stays open.
 */
async function resolveStageExit(
  schema: string,
  wf: string,
  instance: any,
  dag: any,
  stage: any,
  exitFields: { id: string; fieldName: string }[] | null,
): Promise<{ type: 'stage'; stageId: string } | { type: 'completed' } | null> {
  const branches: VotePolicyBranch[] = (stage?.branches || []).map((b: any) => ({
    id: b.id,
    action: b.action,
    votePolicy: b.votePolicy,
    voteCount: b.voteCount,
    expression: b.expression,
    conditionGroups: b.conditionGroups,
    targetType: b.targetType,
    targetStageId: b.targetStageId,
  }));
  // A stage with no outgoing branches is an implicit end.
  if (branches.length === 0) return { type: 'completed' };

  const taskRes = await pool.query(
    `SELECT decisions, decision, assignee_users FROM ${wf}.wf_task WHERE instance_id = $1 AND step_id = $2`,
    [instance.id, stage.id],
  );
  const tasks = taskRes.rows as { decisions?: any; decision?: any; assignee_users?: string[] | null }[];
  const votes: VoteLookup = {};
  let assigneeCount = 0;
  let matchedBranchId: string | null = null;
  for (const t of tasks) {
    if (t.decisions && typeof t.decisions === 'object') Object.assign(votes, t.decisions);
    if (Array.isArray(t.assignee_users)) assigneeCount += t.assignee_users.length;
    if (!matchedBranchId && t.decision?.matchedBranch) matchedBranchId = t.decision.matchedBranch;
  }

  // A task that already resolved via exit conditions pins the exit branch.
  const pinned = branches.find((b) => b.id === matchedBranchId) || null;
  if (pinned) return exitTargetOf(pinned);

  // Otherwise evaluate the branches in order.
  const match = await evaluateExitConditions(
    votes,
    branches,
    {
      variables: instance.vars || {},
      stageId: stage.id,
      assigneeCount,
      record: exitRecordOf(instance.vars || {}),
      fields: exitFields || undefined,
    },
    exitEvaluator,
  );
  if (!match) return null;
  return exitTargetOf(match.branch);
}

/** Convert a branch to its routing target. */
function exitTargetOf(branch: VotePolicyBranch): { type: 'stage'; stageId: string } | { type: 'completed' } {
  const b = branch as any;
  if (b.targetType === 'stage' && b.targetStageId) return { type: 'stage', stageId: b.targetStageId };
  return { type: 'completed' };
}

/**
 * Record an assignee's vote on the current stage's pending task and resolve
 * the task when the stage's exit conditions are met. Returns false when the
 * task was resolved concurrently — the other flow continues progression.
 */
async function recordVote(
  schema: string,
  wf: string,
  instance: any,
  dag: any,
  stage: any,
  decision: { stepId: string; outcome: string; actorId?: string; comment?: string },
  exitFields: { id: string; fieldName: string }[] | null,
): Promise<boolean> {
  const instanceId = instance.id;
  const taskRes = await pool.query(
    `SELECT id, assignee_users FROM ${wf}.wf_task WHERE instance_id = $1 AND step_id = $2 AND status = 'pending'`,
    [instanceId, decision.stepId],
  );
  const task = taskRes.rows[0] as { id: string; assignee_users?: string[] | null } | undefined;
  if (!task) return true; // already decided or no task — nothing to record

  const assignees: string[] = Array.isArray(task.assignee_users) ? task.assignee_users : [];
  const actorId = decision.actorId || '';

  if (!actorId || !assignees.includes(actorId)) {
    await logWfAction(schema, instanceId, decision.stepId, 'vote:ignored', actorId || null, {
      reason: assignees.length === 0 ? 'task has no assignees' : 'actor is not an assignee',
      outcome: decision.outcome,
    });
    return true;
  }

  // Atomic merge: concurrent votes never overwrite each other; a re-vote by
  // the same actor replaces their entry.
  const vote: VoteLookup = {
    [actorId]: { action: decision.outcome, comment: decision.comment || null, at: new Date().toISOString() },
  };
  const upd = await pool.query(
    `UPDATE ${wf}.wf_task SET decisions = COALESCE(decisions, '{}'::jsonb) || $1::jsonb
     WHERE id = $2 AND status = 'pending'`,
    [JSON.stringify(vote), task.id],
  );
  if ((upd.rowCount || 0) === 0) return false; // resolved concurrently

  const votesRes = await pool.query(`SELECT decisions FROM ${wf}.wf_task WHERE id = $1`, [task.id]);
  const votes: VoteLookup = votesRes.rows[0]?.decisions || {};

  const branches: VotePolicyBranch[] = (stage?.branches || []).map((b: any) => ({
    id: b.id,
    action: b.action,
    votePolicy: b.votePolicy,
    voteCount: b.voteCount,
    expression: b.expression,
    conditionGroups: b.conditionGroups,
  }));
  const match = await evaluateExitConditions(
    votes,
    branches,
    {
      variables: instance.vars || {},
      stageId: decision.stepId,
      assigneeCount: assignees.length,
      record: exitRecordOf(instance.vars || {}),
      fields: exitFields || undefined,
      user: await exitUserOf(actorId, !!exitFields),
    },
    exitEvaluator,
  );

  if (match) {
    const resolved = match.action || majorityAction(votes) || 'approved';
    const upd2 = await pool.query(
      `UPDATE ${wf}.wf_task SET decisions = $1, status = $2, decided_by = $3, decision = $4, decided_at = now()
       WHERE id = $5 AND status = 'pending'`,
      [
        JSON.stringify(votes),
        resolved,
        actorId,
        JSON.stringify({ outcome: resolved, matchedBranch: match.branch.id, votes, comment: decision.comment || null }),
        task.id,
      ],
    );
    if ((upd2.rowCount || 0) === 0) return false; // resolved concurrently
    await logWfAction(schema, instanceId, decision.stepId, `decided:${resolved}`, actorId, {
      comment: decision.comment || null,
      matchedBranch: match.branch.id,
    });
  } else {
    await logWfAction(schema, instanceId, decision.stepId, `vote:${decision.outcome}`, actorId, {
      comment: decision.comment || null,
    });
  }
  return true;
}

/** List running instances for a definition across the tenant (failed/completed excluded). */
export async function countInstancesForDefinition(tenantId: string, defId: string): Promise<number> {
  const schema = await resolveTenantSchema(tenantId);
  if (!schema) return 0;
  try {
    const wf = quoteIdent(schema);
    const res = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${wf}.wf_instance WHERE def_id = $1 AND state = 'running'`,
      [defId],
    );
    return res.rows[0]?.n || 0;
  } catch {
    return 0; // table not created yet
  }
}

export const WorkflowEngine = { startInstance, proceedInstance, advanceInstance, countInstancesForDefinition, fireStageEvents, writeExecutionLog };
export { ensureRuntimeTables };
export default WorkflowEngine;
