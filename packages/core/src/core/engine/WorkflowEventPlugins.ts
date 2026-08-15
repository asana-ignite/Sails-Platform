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
import type { WorkflowEventContext, WorkflowEventPlugin, WorkflowEventResult } from '@sails/plugin-sdk';
import { workflowEventRegistry } from '@sails/plugin-sdk';
import { executeScript, SandboxContext } from './ScriptSandbox';
import { evaluateJsonata, genId, logWfAction, quoteIdent, resolveTenantSchema } from './WorkflowHelpers';
import { localize, DEFAULT_LOCALE } from '@sails/shared';
import { normalizeFilters, serializeFilterGroups, validateCollectionValue, validateRecordValue, WORKFLOW_EVENT_CONFIGS } from '@sails/shared';
import type { SessionContext } from '@/lib/auth/session';
import { deliverWorkflowNotification } from './notifications';
import { preprocessFilterGroups } from './filterPreprocess';
import type { WorkflowMacroCtx } from './contextMacros';

/** Cap for filter-driven batch update/delete (RLS-enforced, audited per row). */
const BATCH_LIMIT = 500;

export function fail(ctx: WorkflowEventContext, error: string): WorkflowEventResult {
  return { success: false, error };
}

/** Build a minimal SessionContext from the workflow event context (role fetched from DB). */
export async function buildSession(ctx: WorkflowEventContext): Promise<SessionContext> {
  let role = 'rls_user';
  let locale = 'en';
  try {
    const u = await db.user.findUnique({
      where: { id: ctx.session.userId },
      select: { role: true, locale: true },
    });
    if (u?.role) role = u.role;
    if (u?.locale) locale = u.locale;
  } catch { /* keep default */ }
  return {
    userId: ctx.session.userId,
    tenantId: ctx.tenantId,
    role,
    email: '',
    teams: [],
    activeTeamId: ctx.session.teamId || undefined,
    locale,
    suppressRecordTriggers: !!(ctx as any).suppressRecordTriggers,
  };
}

/** Fetch table metadata needed by QueryLayer.listRecords. */
export async function resolveTableMeta(tenantId: string, tableName: string) {
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
export function serializeRecordFilters(groups: any[], fields: any[]): any[] {
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
export async function buildWorkflowCtx(
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
export function referencesWorkflowContext(...sources: (string | null | undefined)[]): boolean {
  return sources.some((s) => typeof s === 'string' && /(?:record|oldRecord|requestor)\.|\brequest_date\b/.test(s));
}

// ─── Shared Helpers ────────────────────────────────────────────

export function resolveTargetId(ctx: WorkflowEventContext, config: Record<string, any>): string | null {
  const targetType = (config.targetType as string) || 'trigger';
  if (targetType === 'trigger') return ctx.recordId || null;
  if (targetType === 'variable') {
    const v = config.targetValue as string | undefined;
    return v ? (ctx.variables[v] as string) ?? null : null;
  }
  return (config.targetValue as string) || null;
}

export function getPath(obj: any, path: string): any {
  if (obj == null || !path) return undefined;
  let v = obj;
  for (const seg of String(path).split('.')) {
    if (v == null) return undefined;
    v = v[seg];
  }
  return v;
}

export function valueFor(ctx: WorkflowEventContext, m: any, wfCtx?: WorkflowMacroCtx | null): any {
  if (m.source === 'value') return m.value;
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

export function buildPayload(
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

// ─── Expression / Transform events (JSONata) ─────────────────

export function makeJsonataEvent(type: 'expression', label: string, description: string): WorkflowEventPlugin {
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
      if (!result.ok) return fail(ctx, `${'Expression'} error: ${result.error}`);

      const output: Record<string, any> = {};
      if (assignToVariable) output[assignToVariable] = result.value;
      return { success: true, output };
    },
  };
}

// ─── Notification Message event (Form Events modal) ───────────

/**
 * Render `{{expr}}` moustache tokens in a template against the evaluation
 * context (record values + accumulated variables). Plain text passes through
 * untouched; a token that fails to evaluate renders as empty.
 */
async function renderTemplate(raw: string | undefined, ctx: Record<string, any>): Promise<string> {
  const text = String(raw ?? '').trim();
  if (!text) return text;
  const re = /\{\{([^{}]+)\}\}/g;
  const tokens: { start: number; end: number; expr: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ start: m.index, end: m.index + m[0].length, expr: m[1].trim() });
  }
  if (tokens.length === 0) return text;
  let out = '';
  let cursor = 0;
  for (const t of tokens) {
    out += text.slice(cursor, t.start);
    const r = await evaluateJsonata(t.expr, ctx);
    out += r.ok && r.value !== undefined && r.value !== null ? String(r.value) : '';
    cursor = t.end;
  }
  out += text.slice(cursor);
  return out;
}

/**
 * Notification Message — Form-Events modal (confirm / informational alert).
 *
 * Never executes server-side work; it renders the configured box (title,
 * message with {{expr}} tokens, mode, severity, button labels) and returns it
 * in the result. The form-event route detects `result.notificationMessage`,
 * PAUSES the chain and returns the box to the client; the user's choice is
 * then posted back as a resume (confirm/ok → continue, cancel → stop).
 */
export function makeNotificationMessageEvent(): WorkflowEventPlugin {
  return {
    type: 'notification_message',
    label: 'Notification Message',
    description: 'Modal confirmation or informational alert shown to the user',
    parametersSchema: WORKFLOW_EVENT_CONFIGS.notification_message,
    async execute(ctx) {
      const { eventConfig, variables, record } = ctx;
      const mode = eventConfig.mode === 'notification' ? 'notification' : 'confirm';
      const evalCtx: Record<string, any> = {
        ...(variables || {}),
        record: record?.values ?? {},
        oldRecord: record?.oldValues ?? {},
      };
      const locale = (ctx as any).locale || DEFAULT_LOCALE;
      const [title, message] = await Promise.all([
        renderTemplate(localize(eventConfig.title, locale), evalCtx),
        renderTemplate(localize(eventConfig.message, locale), evalCtx),
      ]);
      return {
        success: true,
        notificationMessage: {
          mode,
          notificationType: ['information', 'success', 'warning', 'caution', 'error'].includes(eventConfig.notificationType)
            ? eventConfig.notificationType
            : 'information',
          title: title || eventConfig.label || ctx.eventConfig?.label || 'Notification',
          message,
          confirmLabel: localize(eventConfig.confirmLabel, locale) || 'Confirm',
          cancelLabel: localize(eventConfig.cancelLabel, locale) || 'Cancel',
          okLabel: localize(eventConfig.okLabel, locale) || 'OK',
        },
      };
    },
  };
}
