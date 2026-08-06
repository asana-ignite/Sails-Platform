/**
 * WorkflowEventPlugins — the compile-time built-in Workflow Event Plug-Ins.
 *
 * Each plugin implements execute() for a workflow event type. The 'script'
 * plugin is the BYOC extension point: its config references a RecordScript
 * row, which the plugin loads and runs in the sandbox.
 *
 * Expression and Transform share the JSONata evaluate-and-assign behaviour
 * (they only differ in label/description) — built via a factory below.
 */
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { WorkflowEventContext, WorkflowEventPlugin, WorkflowEventResult } from '@/core/registry/WorkflowEventPlugin';
import { executeScript, SandboxContext } from './ScriptSandbox';
import { genId, logWfAction, quoteIdent, resolveTenantSchema } from './WorkflowHelpers';

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

function fail(ctx: WorkflowEventContext, error: string): WorkflowEventResult {
  return { success: false, error };
}

/** Evaluate a JSONata expression against an input. */
async function evaluateJsonata(
  expression: string,
  input: any,
): Promise<{ ok: boolean; value?: any; error?: string }> {
  if (!jsonataLib) {
    return { ok: false, error: 'JSONata engine is not available — add the jsonata dependency to sails-core' };
  }
  try {
    const expressionFn = jsonataLib(expression);
    const value = await expressionFn.evaluate(input);
    return { ok: true, value };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}

// ─── Record Event ─────────────────────────────────────────────

const recordEventPlugin: WorkflowEventPlugin = {
  type: 'record',
  label: 'Record Event',
  description: 'Read a record from a model and store it to a workflow variable',
  async execute(ctx) {
    const { eventConfig } = ctx;
    const model = eventConfig.model as string | undefined;
    const operation = (eventConfig.operation as string) || 'read';
    const storeToVariable = eventConfig.storeToVariable as string | undefined;

    if (!model) return fail(ctx, 'Record Event requires config.model');
    if (operation !== 'read') {
      return fail(ctx, `Record Event operation '${operation}' is not supported yet — only 'read' is available in v1`);
    }
    if (!storeToVariable) return { success: true };

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');
    if (!/^[a-z][a-z0-9_]*$/.test(model)) return fail(ctx, `Invalid model name '${model}'`);

    try {
      const t = quoteIdent(model);
      const res = await pool.query(
        `SELECT * FROM ${quoteIdent(schema)}.${t} WHERE "tenant_id" = $1 LIMIT 25`,
        [ctx.tenantId],
      );
      const rows = res.rows.map((r: any) => ({ ...r }));
      return { success: true, output: { [storeToVariable]: rows } };
    } catch (error: any) {
      return fail(ctx, `Record Event failed: ${error?.message || error}`);
    }
  },
};

// ─── Notification Event ───────────────────────────────────────

const notificationEventPlugin: WorkflowEventPlugin = {
  type: 'notification',
  label: 'Notification',
  description: 'Record a bell/email notification for a recipient',
  async execute(ctx) {
    const { eventConfig } = ctx;
    const channel = (eventConfig.channel as string) || 'bell';
    const recipients = eventConfig.recipients as string | undefined;
    const subject = eventConfig.subject as string | undefined;
    const message = eventConfig.message as string | undefined;

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');

    try {
      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'notify', ctx.session.userId, {
        channel,
        recipients: recipients || null,
        subject: subject || null,
        message: message || null,
      });
      return { success: true };
    } catch (error: any) {
      return fail(ctx, `Notification Event failed: ${error?.message || error}`);
    }
  },
};

// ─── Task Approval Event ──────────────────────────────────────

const approvalEventPlugin: WorkflowEventPlugin = {
  type: 'approval',
  label: 'Task Approval',
  description: 'Create an approval task assigned to a router (user/team/position/role/field)',
  async execute(ctx) {
    const { eventConfig } = ctx;
    const routerType = (eventConfig.routerType as string) || 'role';
    const routerValue = (eventConfig.routerValue as string) || '';
    const routerLabel = (eventConfig.routerLabel as string) || 'Approver';
    const timeoutHours = eventConfig.timeoutHours as number | null | undefined;

    if (!routerValue && routerType !== 'field') {
      return fail(ctx, `Approval Event requires config.routerValue for router type '${routerType}'`);
    }

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');
    if (!ctx.stageId) return fail(ctx, 'Approval Event requires a stage context');

    const dueAt = timeoutHours && timeoutHours > 0
      ? new Date(Date.now() + timeoutHours * 3600 * 1000)
      : null;

    try {
      const s = quoteIdent(schema);
      const taskId = genId('wft');
      await pool.query(
        `INSERT INTO ${s}.wf_task (id, instance_id, step_id, status, assignee_type, assignee_id, due_at)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
        [taskId, ctx.instanceId, ctx.stageId, routerType, routerValue, dueAt],
      );
      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'task:assigned', ctx.session.userId, {
        taskId,
        routerType,
        routerValue,
        routerLabel,
        dueAt: dueAt ? dueAt.toISOString() : null,
      });
      return { success: true, output: { [`task_${ctx.stageId}`]: taskId } };
    } catch (error: any) {
      return fail(ctx, `Approval Event failed: ${error?.message || error}`);
    }
  },
};

// ─── Expression / Transform events (JSONata) ─────────────────

function makeJsonataEvent(type: 'expression' | 'transform', label: string, description: string): WorkflowEventPlugin {
  return {
    type,
    label,
    description,
    async execute(ctx) {
      const { eventConfig } = ctx;
      const expression = eventConfig.expression as string | undefined;
      const assignToVariable = eventConfig.assignToVariable as string | undefined;

      if (!expression) return fail(ctx, `${label} requires config.expression`);

      const result = await evaluateJsonata(expression, ctx.variables);
      if (!result.ok) return fail(ctx, `${type === 'expression' ? 'Expression' : 'Transform'} error: ${result.error}`);

      const output: Record<string, any> = {};
      if (assignToVariable) output[assignToVariable] = result.value;
      return { success: true, output };
    },
  };
}

const expressionEventPlugin = makeJsonataEvent(
  'expression',
  'Expression Event',
  'Evaluate a JSONata expression and assign the result to a variable',
);

const transformEventPlugin = makeJsonataEvent(
  'transform',
  'Transform Event',
  'Map data with a JSONata expression and assign the result to a variable',
);

// ─── Script Event (BYOC) ──────────────────────────────────────

const scriptEventPlugin: WorkflowEventPlugin = {
  type: 'script',
  label: 'Script Event',
  description: 'Execute a tenant BYOC script in the sandbox',
  async execute(ctx) {
    const { eventConfig } = ctx;
    const scriptId = eventConfig.scriptId as string | undefined;
    const timeoutMs = eventConfig.timeoutMs as number | undefined;

    if (!scriptId) return fail(ctx, 'Script Event requires config.scriptId');

    const script = await db.recordScript.findFirst({
      where: { id: scriptId, tenantId: ctx.tenantId },
    });
    if (!script) return fail(ctx, `Script '${scriptId}' not found`);
    if (!script.isActive) return fail(ctx, `Script '${script.name}' is inactive`);

    const tenant = await db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { schemaName: true },
    });
    if (!tenant?.schemaName) return fail(ctx, 'Tenant schema not found');

    // The triggering record's values come from the engine context (populated
    // by the Record Trigger hook); fall back to empty values when absent.
    const record = ctx.record || { id: ctx.recordId, values: {} };

    const sandboxCtx: SandboxContext = {
      record: { id: record.id, values: { ...record.values }, oldValues: record.oldValues ? { ...record.oldValues } : undefined },
      instance: { id: ctx.instanceId },
      stage: { id: ctx.stageId },
      variables: { ...ctx.variables },
      session: ctx.session,
      table: { name: ctx.tableName },
      operation: ctx.operation || null,
      timing: ctx.timing,
    };

    const result = await executeScript(script.scriptCode, sandboxCtx, {
      tenantId: ctx.tenantId,
      tenantSchema: tenant.schemaName,
      timeoutMs,
    });

    for (const line of result.log) {
      await logWfAction(tenant.schemaName, ctx.instanceId, ctx.stageId, 'script:log', ctx.session.userId, {
        scriptId,
        line,
      }).catch(() => undefined);
    }

    if (!result.ok) {
      return { success: false, output: result.recordValues || undefined, error: result.error };
    }
    return { success: true, output: { ...result.variables, ...(result.recordValues || {}) } };
  },
};

export const WorkflowEventPlugins: WorkflowEventPlugin[] = [
  recordEventPlugin,
  notificationEventPlugin,
  approvalEventPlugin,
  expressionEventPlugin,
  transformEventPlugin,
  scriptEventPlugin,
];
