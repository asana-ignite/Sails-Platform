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
import { QueryLayer } from './QueryLayer';
import { WorkflowEventContext, WorkflowEventPlugin, WorkflowEventResult } from '@/core/registry/WorkflowEventPlugin';
import { executeScript, SandboxContext } from './ScriptSandbox';
import { evaluateJsonata, genId, logWfAction, quoteIdent, resolveTenantSchema } from './WorkflowHelpers';
import { normalizeFilters, serializeFilterGroups, validateCollectionValue, validateRecordValue, WORKFLOW_EVENT_CONFIGS } from '@sails/shared';
import type { SessionContext } from '@/lib/auth/session';
import { MailService } from '@/services/MailService';
import { resolveRecipients, renderTemplate, insertBellNotification, resolveAttachments } from './notifications';
import { preprocessFilterGroups } from './filterPreprocess';
import type { WorkflowMacroCtx } from './contextMacros';

function fail(ctx: WorkflowEventContext, error: string): WorkflowEventResult {
  return { success: false, error };
}

/** Build a minimal SessionContext from the workflow event context (role fetched from DB). */
async function buildSession(ctx: WorkflowEventContext): Promise<SessionContext> {
  let role = 'rls_user';
  try {
    const u = await db.user.findUnique({
      where: { id: ctx.session.userId },
      select: { role: true },
    });
    if (u?.role) role = u.role;
  } catch { /* keep default */ }
  return {
    userId: ctx.session.userId,
    tenantId: ctx.tenantId,
    role,
    email: '',
    teams: [],
    activeTeamId: ctx.session.teamId || undefined,
  };
}

/** Fetch table metadata needed by QueryLayer.listRecords. */
async function resolveTableMeta(tenantId: string, tableName: string) {
  const table = await db.tableDefinition.findFirst({
    where: { tenantId, tableName },
    include: { fields: true },
  });
  if (!table) return null;
  const validFields = new Set<string>(table.fields.map((f) => f.fieldName));
  const textTypes = new Set(['text','varchar','string','char','email','phone','url','description']);
  const textFields = table.fields
    .filter((f) => textTypes.has((f.physicalType || '').toLowerCase()))
    .map((f) => f.fieldName);
  const jsonbFields = new Set<string>(
    table.fields
      .filter((f) => (f.physicalType || '').toLowerCase() === 'jsonb')
      .map((f) => f.fieldName),
  );
  return { table, validFields, textFields, jsonbFields };
}

/** Serialize Record Event filterGroups into QueryLayer-compatible filter rules. */
function serializeRecordFilters(groups: any[], fields: any[]): any[] {
  if (!groups || !groups.length) return [];
  const findField = (idOrName: string) =>
    (fields || []).find((f: any) => f.id === idOrName || f.fieldName === idOrName);
  const normalized = normalizeFilters(groups);
  return serializeFilterGroups(normalized, (fieldId) => findField(fieldId)?.fieldName || null);
}

/**
 * Builds the workflow macro context lazily — only when a serialized rule
 * references the workflow namespace (@wf.requestor*, @wf.request_date,
 * @var.<name>). Resolves the instance starter (wf_instance.created_by) and
 * start date in one query each.
 */
async function buildWorkflowCtx(
  ctx: WorkflowEventContext,
  schema: string,
  filterGroups: any[],
): Promise<WorkflowMacroCtx | null> {
  const needsWorkflowCtx = filterGroups.some((g) =>
    g?.rules?.some((r: any) =>
      typeof r.value === 'string' && (r.value.startsWith('@wf.') || r.value.startsWith('@var.'))
    )
  );
  if (!needsWorkflowCtx) return null;

  const inst = await pool.query(
    `SELECT created_by, created_at FROM ${quoteIdent(schema)}.wf_instance WHERE id = $1`,
    [ctx.instanceId],
  );
  const requestorId = (inst.rows[0]?.created_by as string) || ctx.session.userId || '';
  const createdAt = inst.rows[0]?.created_at as Date | undefined;

  let requestor: WorkflowMacroCtx['requestor'] = null;
  if (requestorId) {
    const u = await db.user.findUnique({
      where: { id: requestorId },
      include: { teams: true, positionSlots: true },
    });
    if (u) {
      requestor = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
        teamId: u.teams?.[0]?.teamId || null,
        positionId: u.positionSlots?.[0]?.positionId || null,
      };
    }
  }

  let requestDate: string | null = null;
  if (createdAt) {
    const d = new Date(createdAt);
    requestDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { variables: ctx.variables || {}, requestor, requestDate };
}

// ─── Record Event ─────────────────────────────────────────────

const recordEventPlugin: WorkflowEventPlugin = {
  type: 'record',
  label: 'Record Event',
  description: 'CRUD on a model via QueryLayer (RLS-enforced)',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.record,
  async execute(ctx) {
    const { eventConfig } = ctx;
    const model = eventConfig.model as string | undefined;
    const operation = (eventConfig.operation as string) || 'read';
    const storeToVariable = eventConfig.storeToVariable as string | undefined;

    if (!model) return fail(ctx, 'Record Event requires config.model');
    if (!/^[a-z][a-z0-9_]*$/.test(model)) return fail(ctx, `Invalid model name '${model}'`);

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');

    try {
      const meta = await resolveTableMeta(ctx.tenantId, model);
      if (!meta) return fail(ctx, `Model '${model}' not found`);
      const filterGroups = serializeRecordFilters(eventConfig.filterGroups, meta.table.fields);
      const ses = await buildSession(ctx);
      if (filterGroups.length > 0) {
        // Resolve drill chains, record sources and context/workflow macros
        // (@today, @me, @wf.requestor, @var.<name>, …) before SQL generation.
        const workflowCtx = await buildWorkflowCtx(ctx, schema, filterGroups);
        await preprocessFilterGroups({
          session: ses,
          tableName: model,
          tableFields: meta.table.fields,
          filterGroups,
          workflowCtx: workflowCtx || undefined,
        });
      }

      let stored: any = null;

      // ── Read (single record) ──
      if (operation === 'read') {
        const filters: Record<string, string> = {};
        // Honor the configured target record (trigger default = ctx.recordId).
        const targetId = resolveTargetId(ctx, eventConfig);
        if (targetId) filters['id:eq'] = targetId;
        const result = await QueryLayer.listRecords(pool, schema, model, {
          filters,
          filterGroups,
          limit: 1, page: 1,
          validFields: meta.validFields,
          textFields: meta.textFields,
          jsonbFields: meta.jsonbFields,
        });
        stored = result.rows[0] || null;
      }

      // ── List (many records) ──
      else if (operation === 'list') {
        const result = await QueryLayer.listRecords(pool, schema, model, {
          filterGroups,
          limit: 25, page: 1,
          validFields: meta.validFields,
          textFields: meta.textFields,
          jsonbFields: meta.jsonbFields,
        });
        stored = result.rows;
      }

      // ── Create ──
      else if (operation === 'create') {
        const payload: Record<string, any> = {};
        const mapping: { sourceVar: string; targetCol: string }[] = eventConfig.fieldMapping || [];
        for (const m of mapping) {
          payload[m.targetCol] = ctx.variables[m.sourceVar];
        }
        stored = await QueryLayer.insertRecord(pool, schema, model, payload, ses);
      }

      // ── Update ──
      else if (operation === 'update') {
        const targetId = resolveTargetId(ctx, eventConfig);
        if (!targetId) return fail(ctx, 'Record Event update requires a target record id');
        const data: Record<string, any> = {};
        const mapping: { sourceVar: string; targetCol: string }[] = eventConfig.fieldMapping || [];
        for (const m of mapping) {
          data[m.targetCol] = ctx.variables[m.sourceVar];
        }
        stored = await QueryLayer.updateRecord(pool, schema, model, targetId, data, ses);
      }

      // ── Upsert (insert, or update the row with the matching id) ──
      else if (operation === 'upsert') {
        const mapping: { sourceVar: string; targetCol: string }[] = eventConfig.fieldMapping || [];
        // Conflict key: a variable mapped onto the id column wins; otherwise
        // fall back to the Target Record selector; otherwise pure insert.
        const mappedId = mapping.find((m) => m.targetCol === 'id')?.sourceVar;
        const idValue = mappedId ? (ctx.variables[mappedId] as string) ?? null : resolveTargetId(ctx, eventConfig);
        const payload: Record<string, any> = {};
        for (const m of mapping) {
          if (m.targetCol === 'id') continue;
          payload[m.targetCol] = ctx.variables[m.sourceVar];
        }
        stored = await QueryLayer.upsertRecord(pool, schema, model, idValue, payload, ses);
      }

      // ── Delete ──
      else if (operation === 'delete') {
        const targetId = resolveTargetId(ctx, eventConfig);
        if (!targetId) return fail(ctx, 'Record Event delete requires a target record id');
        stored = await QueryLayer.deleteRecord(pool, schema, model, targetId, ses);
      }

      else {
        return fail(ctx, `Operation '${operation}' is not supported`);
      }

      // Validate the stored value against the bound variable's declared structure.
      if (storeToVariable && stored !== null && stored !== undefined) {
        const varDef = (ctx.variableDefs || []).find((v: any) => v.name === storeToVariable);
        if (varDef) {
          if (varDef.fieldType === 'record') {
            const row = Array.isArray(stored) ? stored[0] : stored;
            const check = validateRecordValue(row, varDef.columns || []);
            if (!check.ok) {
              return fail(ctx, `Record Event result does not match variable '${storeToVariable}' structure: ${check.errors.slice(0, 3).join('; ')}`);
            }
          } else {
            const shape = {
              itemType: varDef.itemType || (varDef.fieldType === 'collection' ? 'any' : undefined),
              columns: varDef.columns || [],
            };
            if (varDef.fieldType === 'collection' || shape.itemType) {
              const toValidate = Array.isArray(stored) ? stored : [stored];
              const result = validateCollectionValue(toValidate, shape);
              if (!result.ok) {
                return fail(ctx, `Record Event result does not match variable '${storeToVariable}' structure: ${result.errors.slice(0, 3).join('; ')}`);
              }
            }
          }
        }
      }

      return { success: true, output: storeToVariable ? { [storeToVariable]: stored } : {} };
    } catch (error: any) {
      return fail(ctx, `Record Event failed: ${error?.message || error}`);
    }
  },
};

/**
 * Resolve the target record id for read/update/upsert/delete operations from
 * the event config: 'trigger' uses ctx.recordId, 'variable' reads from the
 * named workflow variable, 'literal' uses the literal value.
 */
function resolveTargetId(ctx: WorkflowEventContext, config: Record<string, any>): string | null {
  const targetType = (config.targetType as string) || 'trigger';
  if (targetType === 'trigger') return ctx.recordId || null;
  if (targetType === 'variable') {
    const v = config.targetValue as string | undefined;
    return v ? (ctx.variables[v] as string) ?? null : null;
  }
  // literal
  return (config.targetValue as string) || null;
}

// ─── Notification Event ───────────────────────────────────────

const notificationEventPlugin: WorkflowEventPlugin = {
  type: 'notification',
  label: 'Notification',
  description: 'Send bell / email notifications to resolved recipients',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.notification,
  async execute(ctx) {
    const { eventConfig } = ctx;
    const channel = (eventConfig.channel as string) || 'bell';
    const recipientsRaw = (eventConfig.recipients as string) || '';
    const subjectTpl = (eventConfig.subject as string) || '';
    const bodyTpl = (eventConfig.message as string) || '';

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');

    if (!recipientsRaw) {
      return fail(ctx, 'Notification Event requires recipients');
    }

    const recordValues = ctx.record?.values?.id ? ctx.record.values : (ctx.variables ?? {});
    const recipients = await resolveRecipients(ctx.tenantId, recipientsRaw, ctx.variables);
    if (recipients.length === 0) {
      // No concrete recipients — warn but don't error (template may resolve later).
      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'notify:no_recipients', ctx.session.userId, {
        channel,
        recipientsRaw: recipientsRaw || null,
      });
      return { success: true };
    }

    const subject = renderTemplate(subjectTpl, ctx.variables, ctx.record);
    const body = renderTemplate(bodyTpl, ctx.variables, ctx.record);

    const emailRecipients = recipients
      .filter((r) => r.email)
      .map((r) => r.email)
      .filter((v, i, a) => a.indexOf(v) === i); // dedupe emails

    let bellCount = 0;
    let emailResult: any = null;

    // ── Bell ──
    if (channel === 'bell' || channel === 'both') {
      bellCount = await insertBellNotification(schema, ctx.instanceId, recipients, subject, body);
      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'notify:bell', ctx.session.userId, {
        channel,
        recipients: recipients.map((r) => r.userId || r.email).join(', '),
        count: bellCount,
      });
    }

    // ── Email ──
    if ((channel === 'email' || channel === 'both') && emailRecipients.length > 0) {
      emailResult = await MailService.send({
        to: emailRecipients,
        subject: subject || ctx.variables['workflow_name'] || 'Workflow notification',
        html: body || subject || '',
        tenantId: ctx.tenantId,
        connectionId: eventConfig.emailConnectionId as string | undefined,
        attachments: resolveAttachments(
          eventConfig.attachments as any[] | undefined,
          ctx.record,
          ctx.variables,
        ),
      });
      await logWfAction(schema, ctx.instanceId, ctx.stageId,
        emailResult.ok ? 'notify:email' : 'notify:email:error', ctx.session.userId, {
          to: emailRecipients,
          subject,
          status: emailResult.ok ? 'sent' : 'failed',
          error: emailResult.error || null,
        });
      if (!emailResult.ok) {
        return fail(ctx, `Email delivery failed: ${emailResult.error}`);
      }
    }

    return { success: true, output: { notified: bellCount + emailRecipients.length } };
  },
};

// ─── Task Approval Event ──────────────────────────────────────

const approvalEventPlugin: WorkflowEventPlugin = {
  type: 'approval',
  label: 'Task Approval',
  description: 'Create an approval task assigned to a router (user/team/position/role/field)',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.approval,
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
    parametersSchema: WORKFLOW_EVENT_CONFIGS[type],
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
  parametersSchema: WORKFLOW_EVENT_CONFIGS.script,
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

    // Validate the script's variable mutations against the declared structures.
    const merged = { ...result.variables, ...(result.recordValues || {}) };
    for (const v of ctx.variableDefs || []) {
      if (merged[v.name] === undefined) continue;
      if (v.fieldType === 'record') {
        const check = validateRecordValue(merged[v.name], v.columns || []);
        if (!check.ok) {
          return {
            success: false,
            error: `Script result for variable '${v.name}' does not match its structure: ${check.errors.slice(0, 3).join('; ')}`,
          };
        }
        continue;
      }
      if (v.fieldType !== 'collection' && !v.itemType) continue;
      const shape = { itemType: v.itemType || 'any', columns: v.columns || [] };
      const check = validateCollectionValue(merged[v.name], shape);
      if (!check.ok) {
        return {
          success: false,
          error: `Script result for variable '${v.name}' does not match its structure: ${check.errors.slice(0, 3).join('; ')}`,
        };
      }
    }

    return { success: true, output: merged };
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
