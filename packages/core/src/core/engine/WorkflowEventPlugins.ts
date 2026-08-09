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
import { deliverWorkflowNotification } from './notifications';
import { preprocessFilterGroups } from './filterPreprocess';
import type { WorkflowMacroCtx } from './contextMacros';

/** Cap for filter-driven batch update/delete (RLS-enforced, audited per row). */
const BATCH_LIMIT = 500;

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

/** Serialize Record Event filterGroups into QueryLayer-compatible filter rules.
 * The metadata field list excludes `id`, but every table has it — a virtual
 * entry lets QueryStudio's `id = <UUID>` rules resolve to the real column. */
function serializeRecordFilters(groups: any[], fields: any[]): any[] {
  if (!groups || !groups.length) return [];
  const withId = [...(fields || []), { id: 'id', fieldName: 'id' }];
  const findField = (idOrName: string) =>
    withId.find((f: any) => f.id === idOrName || f.fieldName === idOrName);
  const normalized = normalizeFilters(groups);
  return serializeFilterGroups(normalized, (fieldId) => findField(fieldId)?.fieldName || null);
}

/**
 * Builds the workflow macro context lazily — only when a serialized rule
 * references the workflow namespace (@wf.requestor*, @wf.request_date,
 * @var.<name>) or `force` is set (payload/template sources: requestor,
 * request_date, record_old). Resolves the instance starter
 * (wf_instance.created_by) and start date in one query each.
 */
async function buildWorkflowCtx(
  ctx: WorkflowEventContext,
  schema: string,
  filterGroups: any[],
  force = false,
): Promise<WorkflowMacroCtx | null> {
  const needsWorkflowCtx = force || filterGroups.some((g) =>
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

  return { variables: ctx.variables || {}, requestor, requestDate, record: ctx.record?.values ?? null, oldRecord: ctx.record?.oldValues ?? null };
}

/** True when any template/mapping string references the workflow context. */
function referencesWorkflowContext(...sources: (string | null | undefined)[]): boolean {
  return sources.some((s) => typeof s === 'string' && /(?:record|oldRecord|requestor)\.|\brequest_date\b/.test(s));
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
      // Workflow context (requestor/request_date) is needed for @wf.* macros in
      // filters, and for payload mappings sourced from the Workflow Context tree.
      const mapping = (eventConfig.fieldMapping || []) as any[];
      const needsWfCtx = mapping.some((m) => m.source === 'wf' || m.source === 'record_old');
      let workflowCtx: WorkflowMacroCtx | null = null;
      if (filterGroups.length > 0 || needsWfCtx) {
        // Resolve drill chains, record sources and context/workflow macros
        // (@today, @me, @wf.requestor, @var.<name>, …) before SQL generation.
        workflowCtx = await buildWorkflowCtx(ctx, schema, filterGroups, needsWfCtx);
        if (filterGroups.length > 0) {
          await preprocessFilterGroups({
            session: ses,
            tableName: model,
            tableFields: meta.table.fields,
            filterGroups,
            workflowCtx: workflowCtx || undefined,
          });
        }
      }

      let stored: any = null;
      // Batch update/delete (filter-driven) produce no storable result.
      let batchMode = false;

      // ── Read (single record) ──
      if (operation === 'read') {
        const filters: Record<string, string> = {};
        // Target comes from the QueryStudio filter (optionally `id = <UUID>`);
        // default = the triggering record / legacy Target Record config.
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
        const payload = buildPayload(ctx, eventConfig, workflowCtx, meta.table.fields);
        // A mapped `id` (UUID) on create supplies the record's id explicitly.
        const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
        if (idEntry) {
          const idVal = valueFor(ctx, idEntry, workflowCtx);
          if (idVal != null && idVal !== '') payload.id = idVal;
        }
        stored = await QueryLayer.insertRecord(pool, schema, model, payload, ses);
      }

      // ── Update ──
      else if (operation === 'update') {
        const data = buildPayload(ctx, eventConfig, workflowCtx, meta.table.fields);
        const hasFilter = filterGroups.length > 0;
        if (hasFilter) {
          // Batch: apply the payload to EVERY record matching the filter
          // (RLS-enforced reads + per-row audited updates, capped).
          batchMode = true;
          const rows = await QueryLayer.listRecords(pool, schema, model, {
            filterGroups,
            limit: BATCH_LIMIT, page: 1,
            validFields: meta.validFields,
            textFields: meta.textFields,
            jsonbFields: meta.jsonbFields,
          });
          for (const row of rows.rows) {
            await QueryLayer.updateRecord(pool, schema, model, row.id, data, ses);
          }
        } else {
          // Single record: a source mapped onto the id column wins (the Input
          // step's id mapping), falling back to legacy Target Record configs.
          const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
          const targetId = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
          if (!targetId) return fail(ctx, 'Record Event update requires a target record id (map a source onto the id column, or set a Record Filter)');
          stored = await QueryLayer.updateRecord(pool, schema, model, targetId, data, ses);
        }
      }

      // ── Upsert (insert, or update the row with the matching id) ──
      else if (operation === 'upsert') {
        const mapping: any[] = eventConfig.fieldMapping || [];
        // Conflict key: a source mapped onto the id column wins (variable,
        // triggering record or workflow context); otherwise the Target Record
        // selector; else a pure insert with a generated id.
        const idEntry = mapping.find((m) => m.targetCol === 'id');
        const idValue = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
        const payload: Record<string, any> = {};
        for (const m of mapping) {
          if (m.targetCol === 'id') continue;
          payload[m.targetCol] = valueFor(ctx, m, workflowCtx);
        }
        stored = await QueryLayer.upsertRecord(pool, schema, model, idValue, payload, ses);
      }

      // ── Delete ──
      else if (operation === 'delete') {
        const hasFilter = filterGroups.length > 0;
        if (hasFilter) {
          // Batch: delete EVERY record matching the filter (RLS-enforced
          // reads + per-row audited deletes, capped).
          batchMode = true;
          const rows = await QueryLayer.listRecords(pool, schema, model, {
            filterGroups,
            limit: BATCH_LIMIT, page: 1,
            validFields: meta.validFields,
            textFields: meta.textFields,
            jsonbFields: meta.jsonbFields,
          });
          for (const row of rows.rows) {
            await QueryLayer.deleteRecord(pool, schema, model, row.id, ses);
          }
        } else {
          // Single record: the mapped id column (Input step) or legacy Target Record.
          const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
          const targetId = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
          if (!targetId) return fail(ctx, 'Record Event delete requires a target record id (map a source onto the id column, or set a Record Filter)');
          stored = await QueryLayer.deleteRecord(pool, schema, model, targetId, ses);
        }
      }

      else {
        return fail(ctx, `Operation '${operation}' is not supported`);
      }

      // Validate the stored value against the bound variable's declared structure
      // (skipped for batch runs — no single result).
      if (!batchMode && storeToVariable && stored !== null && stored !== undefined) {
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

      // Output mapping: single-record results → workflow variables (batch,
      // list and delete produce no single row, so they are skipped).
      const outVals: Record<string, any> = {};
      if (!batchMode && operation !== 'list' && operation !== 'delete' && stored != null && !Array.isArray(stored)) {
        const outMap = (eventConfig.outputMapping || []) as { sourceField: string; targetVar: string }[];
        for (const om of outMap) {
          if (om.targetVar) outVals[om.targetVar] = getPath(stored, om.sourceField);
        }
      }

      return { success: true, output: { ...(storeToVariable ? { [storeToVariable]: stored } : {}), ...outVals } };
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

/** Walk a dotted path (e.g. 'address.city') through an object. */
function getPath(obj: any, path: string): any {
  if (obj == null || !path) return undefined;
  let v = obj;
  for (const seg of String(path).split('.')) {
    if (v == null) return undefined;
    v = v[seg];
  }
  return v;
}

/**
 * Resolve one field-mapping entry's input value by source:
 * 'record' → the triggering record's current field value (dotted paths like
 * 'address.city' supported), 'record_old' → its value before the change,
 * 'wf' → the workflow context (requestor.* / request_date),
 * anything else / legacy entries → the named workflow variable — with an
 * optional field (record variable / structured JSON) and item index (collection).
 */
function valueFor(ctx: WorkflowEventContext, m: any, wfCtx?: WorkflowMacroCtx | null): any {
  if (m.source === 'record') return getPath(ctx.record?.values, m.sourceField ?? m.targetCol);
  if (m.source === 'record_old') return getPath(ctx.record?.oldValues, m.sourceField ?? m.targetCol);
  if (m.source === 'wf') {
    const f = String(m.sourceField || '');
    if (f === 'request_date') return wfCtx?.requestDate ?? null;
    if (f.startsWith('requestor.')) {
      const key = f.slice('requestor.'.length);
      return wfCtx?.requestor ? getPath(wfCtx.requestor, key) ?? null : null;
    }
    return null;
  }
  const v = ctx.variables[m.sourceVar];
  if (!m.sourceField || v == null) return v;
  const base = Array.isArray(v) ? v[m.itemIndex ?? 0] : v;
  return getPath(base, m.sourceField);
}

/** Build a create/update/upsert payload from the field mapping (any source).
 * Whole-record values (a record/collection source with no field) resolve by
 * target column: relation/lookup → the record's id; otherwise the object is
 * kept (pg-format stringifies it for JSONB columns). */
function buildPayload(
  ctx: WorkflowEventContext,
  eventConfig: Record<string, any>,
  wfCtx?: WorkflowMacroCtx | null,
  tableFields?: any[],
): Record<string, any> {
  const payload: Record<string, any> = {};
  const mapping: any[] = eventConfig.fieldMapping || [];
  const isRel = (name: string) =>
    !!tableFields?.some((f) => (f.fieldName === name) && (f.logicalType === 'relation' || f.logicalType === 'lookup'));
  for (const m of mapping) {
    if (m.targetCol === 'id') continue;
    const val = valueFor(ctx, m, wfCtx);
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      payload[m.targetCol] = isRel(m.targetCol) ? (val.id ?? null) : val;
    } else {
      payload[m.targetCol] = val;
    }
  }
  return payload;
}

// ─── Notification Event ───────────────────────────────────────

const notificationEventPlugin: WorkflowEventPlugin = {
  type: 'notification',
  label: 'Notification',
  description: 'Send bell / email notifications to resolved recipients',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.notification,
  async execute(ctx) {
    const { eventConfig } = ctx;
    const channel = (['email', 'bell', 'both'].includes(eventConfig.channel as string) ? eventConfig.channel : 'bell') as 'email' | 'bell' | 'both';
    // Per-channel recipient lists (Email ⇄ Bell panels). Legacy configs only
    // carry `channel` + `recipients` — fall back to the shared list for both.
    const emailRaw = (eventConfig.emailRecipients ?? eventConfig.recipients ?? '') as string | Array<string | { __expr: string }>;
    const bellRaw = (eventConfig.bellRecipients ?? eventConfig.recipients ?? '') as string | Array<string | { __expr: string }>;
    const recipientsRaw = channel === 'email' ? emailRaw : channel === 'bell' ? bellRaw : emailRaw;
    const subjectTpl = (eventConfig.subject as string) || '';
    const bodyTpl = (eventConfig.message as string) || '';

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');

    if (!recipientsRaw || (Array.isArray(recipientsRaw) && recipientsRaw.length === 0)) {
      return fail(ctx, 'Notification Event requires recipients');
    }

    // Workflow-context templates ({{record.x}}, {{oldRecord.x}}, {{requestor.x}}, {{request_date}}).
    const templates = [
      subjectTpl, bodyTpl,
      typeof recipientsRaw === 'string' ? recipientsRaw : '',
      JSON.stringify(eventConfig.attachments || []),
    ];
    const wfCtx = referencesWorkflowContext(...templates)
      ? await buildWorkflowCtx(ctx, schema, [], true)
      : null;

    const result = await deliverWorkflowNotification({
      tenantId: ctx.tenantId,
      schema,
      instanceId: ctx.instanceId,
      stageId: ctx.stageId,
      actorId: ctx.session.userId || null,
      channel,
      emailRecipients: emailRaw,
      bellRecipients: bellRaw,
      emailCc: eventConfig.emailCc as string | undefined,
      emailBcc: eventConfig.emailBcc as string | undefined,
      subject: subjectTpl,
      message: bodyTpl,
      attachments: eventConfig.attachments as any[] | undefined,
      variables: ctx.variables,
      record: ctx.record,
      workflowCtx: wfCtx,
      emailConnectionId: eventConfig.emailConnectionId as string | undefined,
    });

    if (result.noRecipients) {
      // No concrete recipients — warn but don't error (template may resolve later).
      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'notify:no_recipients', ctx.session.userId, {
        channel,
        recipientsRaw: typeof recipientsRaw === 'string' ? recipientsRaw : JSON.stringify(recipientsRaw),
      });
      return { success: true };
    }
    if (!result.ok) {
      return fail(ctx, `Email delivery failed: ${result.error}`);
    }
    return { success: true, output: { notified: result.bellCount ?? 0 } };
  },
};

// ─── Task Approval Event ──────────────────────────────────────

export interface ResolvedAssigneeUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AssigneeRef {
  type: 'user' | 'role' | 'team' | 'position';
  value: string;
}

/**
 * Parse a router token ("user:<id|email>", "role:<name>", "team:<name|id>",
 * "position:<name|id>") or a { type, value } object. A bare value falls back
 * to `defaultType` (the configured Router Type for static references).
 */
export function parseAssigneeRef(raw: any, defaultType: string): AssigneeRef | null {
  if (raw && typeof raw === 'object' && raw.type && raw.value) {
    const t = String(raw.type).toLowerCase();
    if (t === 'user' || t === 'role' || t === 'team' || t === 'position') {
      return { type: t, value: String(raw.value).trim() };
    }
    return null;
  }
  const token = String(raw ?? '').trim();
  if (!token) return null;
  const m = token.match(/^(user|role|team|position)\:(.+)$/i);
  if (m) return { type: m[1].toLowerCase() as AssigneeRef['type'], value: m[2].trim() };
  if (defaultType) return { type: defaultType as AssigneeRef['type'], value: token };
  return null;
}

/**
 * Resolve an assignee reference to the CURRENT people who hold it:
 * role → active users with that role; team → current members; position →
 * filled position slots; user → the user by id or email (ids/names matched
 * case-insensitively for team/position by name-or-id).
 */
export async function resolveAssigneeUsers(tenantId: string, type: AssigneeRef['type'], value: string): Promise<ResolvedAssigneeUser[]> {
  const userSel = { id: true as const, name: true as const, email: true as const };
  if (type === 'user') {
    const u = await db.user.findFirst({
      where: { tenantId, isActive: true, OR: [{ id: value }, { email: value.toLowerCase() }] },
      select: userSel,
    });
    return u ? [u] : [];
  }
  if (type === 'role') {
    return db.user.findMany({
      where: { tenantId, role: value, isActive: true },
      select: userSel,
    });
  }
  if (type === 'team') {
    const team = await db.team.findFirst({
      where: { tenantId, OR: [{ id: value }, { name: value }] },
      select: { id: true },
    });
    if (!team) return [];
    const members = await db.userTeam.findMany({
      where: { teamId: team.id },
      select: { user: { select: userSel } },
    });
    return members.map((m) => m.user).filter((u): u is ResolvedAssigneeUser => !!u);
  }
  // position
  const position = await db.position.findFirst({
    where: { tenantId, OR: [{ id: value }, { name: value }] },
    select: { id: true },
  });
  if (!position) return [];
  const slots = await db.positionSlot.findMany({
    where: { positionId: position.id, userId: { not: null } },
    select: { user: { select: userSel } },
  });
  return slots.map((s) => s.user).filter((u): u is ResolvedAssigneeUser => !!u);
}

const approvalEventPlugin: WorkflowEventPlugin = {
  type: 'approval',
  label: 'Task Approval',
  description: 'Create an approval task assigned to a router (user/team/position/role/field)',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.approval,
  async execute(ctx) {
    const { eventConfig } = ctx;
    const routerType = (eventConfig.routerType as string) || 'role';
    const routerValue = (eventConfig.routerValue as string) || '';
    const routerRefs = Array.isArray(eventConfig.routerRefs) ? eventConfig.routerRefs.filter(Boolean) : [];
    const routerLabel = (eventConfig.routerLabel as string) || 'Approver';
    const timeoutHours = eventConfig.timeoutHours as number | null | undefined;

    if (!routerValue && !routerRefs.length && routerType !== 'field') {
      return fail(ctx, `Approval Event requires config.routerValue for router type '${routerType}'`);
    }

    const schema = await resolveTenantSchema(ctx.tenantId);
    if (!schema) return fail(ctx, 'Tenant schema not found');
    if (!ctx.stageId) return fail(ctx, 'Approval Event requires a stage context');

    const dueAt = timeoutHours && timeoutHours > 0
      ? new Date(Date.now() + timeoutHours * 3600 * 1000)
      : null;

    try {
      // ── Resolve the assignee reference(s) to the CURRENT holders ──
      // Bare values fall back to the configured router type (static role/team/
      // position/user references). Dynamic sources (field / variable /
      // expression) may also yield tokens ("role:x"…), {type,value} objects or
      // arrays (multi-assignee).
      const staticLike = ['user', 'role', 'team', 'position'].includes(routerType);
      const defaultType = staticLike ? routerType : 'user';

      let rawRefs: any[];
      if (routerRefs.length > 0) {
        rawRefs = routerRefs;
      } else if (routerType === 'field') {
        rawRefs = [ctx.record?.values?.[routerValue]];
      } else if (routerType === 'variable') {
        rawRefs = [ctx.variables[routerValue]];
      } else if (routerType === 'expression') {
        // Evaluate the JSONata expression against the merged workflow context.
        let evalCtx: Record<string, any> = ctx.variables;
        if (referencesWorkflowContext(routerValue)) {
          const wfCtx = await buildWorkflowCtx(ctx, schema, [], true);
          evalCtx = {
            ...ctx.variables,
            record: ctx.record?.values ?? {},
            oldRecord: ctx.record?.oldValues ?? {},
            requestor: wfCtx?.requestor ?? null,
            request_date: wfCtx?.requestDate ?? null,
          };
        }
        const expr = await evaluateJsonata(routerValue, evalCtx);
        if (!expr.ok) return fail(ctx, `Approval Event assignee expression error: ${expr.error}`);
        rawRefs = Array.isArray(expr.value) ? expr.value : [expr.value];
      } else {
        rawRefs = [routerValue];
      }

      const refs: AssigneeRef[] = [];
      for (const raw of rawRefs) {
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const r = parseAssigneeRef(item, defaultType);
            if (r && r.value) refs.push(r);
          }
        } else {
          const r = parseAssigneeRef(raw, defaultType);
          if (r && r.value) refs.push(r);
        }
      }

      const resolved: ResolvedAssigneeUser[] = [];
      for (const ref of refs) {
        const found = await resolveAssigneeUsers(ctx.tenantId, ref.type, ref.value);
        for (const u of found) {
          if (!resolved.some((x) => x.id === u.id)) resolved.push(u);
        }
      }

      // ── Persist the task (descriptor + resolved users for a future inbox) ──
      const assigneeType = refs.length === 1 ? refs[0].type : routerType;
      const assigneeId = refs.length === 1 ? refs[0].value : JSON.stringify(refs.map((r) => r.value));
      const assigneeUserIds = resolved.map((u) => u.id);

      const s = quoteIdent(schema);
      const taskId = genId('wft');
      const actions = Array.isArray(eventConfig.actions) && eventConfig.actions.length > 0
        ? eventConfig.actions
        : [
            ...(eventConfig.canApprove !== false ? [{ label: 'Approve', value: 'approve' }] : []),
            ...(eventConfig.canReject !== false ? [{ label: 'Reject', value: 'reject' }] : []),
          ];
      await pool.query(
        `INSERT INTO ${s}.wf_task (id, instance_id, step_id, status, assignee_type, assignee_id, assignee_users, actions, due_at)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)`,
        [taskId, ctx.instanceId, ctx.stageId, assigneeType, assigneeId, JSON.stringify(assigneeUserIds), JSON.stringify(actions), dueAt],
      );

      // ── Approval notification (reuses the Notification event's delivery) ──
      // Gated by "Send to Email" / "Send to Bell" checkboxes (Simple Action
      // Reply model). There are no To / CC / BCC fields: email and bell both
      // target the resolved assignees. Failures are logged and never break the
      // task.
      const notifyEmail = eventConfig.notifyEmail !== false;
      const notifyBell = eventConfig.notifyBell !== false;
      if (notifyEmail || notifyBell) {
        try {
          const notifEmailRaw = resolved.map((u) => u.email).filter((e): e is string => !!e).join(', ');
          const notifBellRaw = resolved.map((u) => 'user:' + u.id).join(', ');
          const notifSources = [notifEmailRaw, notifBellRaw, String(eventConfig.subject ?? ''), String(eventConfig.message ?? '')];
          const notifWfCtx = referencesWorkflowContext(...notifSources)
            ? await buildWorkflowCtx(ctx, schema, [], true)
            : null;
          await deliverWorkflowNotification({
            tenantId: ctx.tenantId,
            schema,
            instanceId: ctx.instanceId,
            stageId: ctx.stageId,
            actorId: ctx.session.userId || null,
            channel: notifyEmail && notifyBell ? 'both' : notifyEmail ? 'email' : 'bell',
            emailRecipients: notifEmailRaw,
            bellRecipients: notifBellRaw,
            subject: eventConfig.subject as string | undefined,
            message: eventConfig.message as string | undefined,
            attachments: eventConfig.attachments as any[] | undefined,
            variables: ctx.variables,
            record: ctx.record,
            workflowCtx: notifWfCtx,
            emailConnectionId: eventConfig.emailConnectionId as string | undefined,
          });
        } catch (notifErr: any) {
          await logWfAction(schema, ctx.instanceId, ctx.stageId, 'approval:notify:error', ctx.session.userId, {
            taskId,
            error: notifErr?.message || String(notifErr),
          }).catch(() => undefined);
        }
      }

      if (resolved.length === 0) {
        // No current holder — keep the task pending (assignee_users empty) so
        // it can be re-assigned later; audit the gap for visibility.
        await logWfAction(schema, ctx.instanceId, ctx.stageId, 'task:no_assignee', ctx.session.userId, {
          taskId,
          routerType,
          routerValue,
          routerLabel,
          refs: refs.map((r) => `${r.type}:${r.value}`),
        });
        return { success: true, output: { [`task_${ctx.stageId}`]: taskId, [`task_${ctx.stageId}_assignees`]: [] } };
      }

      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'task:assigned', ctx.session.userId, {
        taskId,
        routerType,
        routerValue,
        routerLabel,
        assigneeType,
        assigneeId,
        assignees: resolved.map((u) => u.id),
        dueAt: dueAt ? dueAt.toISOString() : null,
      });
      return {
        success: true,
        output: { [`task_${ctx.stageId}`]: taskId, [`task_${ctx.stageId}_assignees`]: assigneeUserIds },
      };
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

      const schema = await resolveTenantSchema(ctx.tenantId);
      if (!schema) return fail(ctx, 'Tenant schema not found');

      // Workflow-context expressions (record. / oldRecord. / requestor. / request_date)
      // evaluate against the merged context; otherwise variables only.
      let evalCtx: Record<string, any> = ctx.variables;
      if (referencesWorkflowContext(expression)) {
        const wfCtx = await buildWorkflowCtx(ctx, schema, [], true);
        evalCtx = {
          ...ctx.variables,
          record: ctx.record?.values ?? {},
          oldRecord: ctx.record?.oldValues ?? {},
          requestor: wfCtx?.requestor ?? null,
          request_date: wfCtx?.requestDate ?? null,
        };
      }

      const result = await evaluateJsonata(expression, evalCtx);
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
