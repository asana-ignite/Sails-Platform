/**
 * ApprovalEventPlugin — approval step executor (creates wf_task rows and
 * routes decisions back into the running instance).
 */
import type { WorkflowEventPlugin, WorkflowEventContext } from '@sails/plugin-sdk';
import { db } from 'sails-core/src/lib/db';
import { pool } from 'sails-core/src/lib/knex';
import { fail, referencesWorkflowContext, buildWorkflowCtx } from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { resolveTenantSchema, evaluateJsonata, quoteIdent, genId, logWfAction } from 'sails-core/src/core/engine/WorkflowHelpers';
import { deliverWorkflowNotification } from 'sails-core/src/core/engine/notifications';
import { WORKFLOW_EVENT_CONFIGS, evaluateFilterGroups } from '@sails/shared';
import type { FilterEvalContext, FilterEvalUser, SailsFieldDefinition } from '@sails/shared';

export interface ResolvedAssigneeUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AssigneeRef {
  type: 'user' | 'role' | 'team' | 'position';
  value: string;
}

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
    const rawVal = value.trim();
    const cleanRole = rawVal.toUpperCase().replace(/\s+/g, '_');
    return db.user.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { role: { equals: rawVal, mode: 'insensitive' } },
          { role: { equals: cleanRole, mode: 'insensitive' } },
        ],
      },
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
      where: { teamId: team.id, user: { isActive: true } },
      select: { user: { select: userSel } },
    });
    return members.map((m) => m.user).filter((u): u is ResolvedAssigneeUser => !!u);
  }
  const position = await db.position.findFirst({
    where: { tenantId, OR: [{ id: value }, { name: value }] },
    select: { id: true },
  });
  if (!position) return [];
  const slots = await db.positionSlot.findMany({
    where: { positionId: position.id, userId: { not: null }, user: { isActive: true } },
    select: { user: { select: userSel } },
  });
  return slots.map((s) => s.user).filter((u): u is ResolvedAssigneeUser => !!u);
}

const approvalEventPlugin: WorkflowEventPlugin = {
  type: 'approval',
  label: 'Task Approval',
  description: 'Create an approval task assigned to a router (user/team/position/role)',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.approval,
  async execute(ctx: WorkflowEventContext) {
    const { eventConfig, timing } = ctx;

    // Task creation happens only when the stage is ENTERED. At stage_exit the
    // approval event is a no-op — re-running it would duplicate the task and
    // re-notify assignees on an already-resolved stage.
    if (timing === 'stage_exit') return { success: true };

    let routerType = (eventConfig.routerType as string) || 'role';
    let routerValue = (eventConfig.routerValue as string) || '';
    let routerRefs = Array.isArray(eventConfig.routerRefs) ? eventConfig.routerRefs.filter(Boolean) : [];
    const routerLabel = (eventConfig.routerLabel as string) || 'Approver';
    const timeoutHours = eventConfig.timeoutHours as number | null | undefined;
    let routerValueType = (eventConfig.routerValueType as string) || 'user';
    let matchedRuleId: string | null = null;

    // ── Assignee Conditions: rules are evaluated top-to-bottom; the FIRST
    //    matching rule's assignee config wins. The default (fallback) config
    //    is used when no rule matches — or when there are no rules at all.
    const assigneeRules = Array.isArray(eventConfig.assigneeRules) ? eventConfig.assigneeRules : [];
    if (assigneeRules.length > 0) {
      const record = {
        ...(ctx.record?.values || {}),
        id: ctx.record?.id ?? ctx.recordId ?? undefined,
        ...(ctx.record?.oldValues ? { oldValues: ctx.record.oldValues } : {}),
      };
      let user: FilterEvalUser | undefined;
      if (ctx.session?.userId) {
        try {
          const u = await db.user.findUnique({ where: { id: ctx.session.userId }, select: { role: true, email: true } });
          user = u ? { id: ctx.session.userId, role: u.role || undefined, email: u.email || undefined } : { id: ctx.session.userId };
        } catch {
          user = { id: ctx.session.userId };
        }
      }
      let fields: SailsFieldDefinition[] = [];
      if (ctx.tableName) {
        try {
          const td = await db.tableDefinition.findFirst({
            where: { tenantId: ctx.tenantId, tableName: ctx.tableName },
            include: { fields: true },
          });
          if (td) fields = (td.fields || []) as unknown as SailsFieldDefinition[];
        } catch {
          // No fields metadata — record rules fall back to fieldName keys.
        }
      }
      const evalCtx: FilterEvalContext = {
        record,
        vars: ctx.variables || {},
        user,
        fields,
        evaluateExpression: async (expr: string, input: any) => {
          const r = await evaluateJsonata(expr, input);
          return r.ok ? r.value : undefined;
        },
      };
      for (const rule of assigneeRules) {
        const groups = Array.isArray(rule?.conditionGroups) ? rule.conditionGroups : [];
        const hasRules = groups.some((g: any) => (g?.rules || []).length > 0);
        if (!hasRules) continue; // no condition built yet — inactive
        if (await evaluateFilterGroups(groups, evalCtx)) {
          matchedRuleId = String(rule?.id ?? '');
          if (rule?.routerType) routerType = String(rule.routerType);
          routerValue = String(rule?.routerValue ?? '');
          routerRefs = Array.isArray(rule?.routerRefs) ? rule.routerRefs.filter(Boolean) : [];
          routerValueType = (rule?.routerValueType as string) || 'user';
          break;
        }
      }
    }

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
      const staticLike = ['user', 'role', 'team', 'position'].includes(routerType);
      let defaultType = staticLike ? routerType : 'user';

      let rawRefs: any[];
      if (routerRefs.length > 0) {
        rawRefs = routerRefs;
      } else if (routerType === 'field') {
        rawRefs = [ctx.record?.values?.[routerValue]];
      } else if (routerType === 'variable') {
        // The "Variable holds" kind declared in the Assign To picker decides
        // how the variable's VALUE resolves; an explicit type: prefix in the
        // value itself still wins over the declared kind.
        defaultType = routerValueType;
        rawRefs = [ctx.variables[routerValue]];
      } else if (routerType === 'expression') {
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

      const resolvedLists = await Promise.all(
        refs.map((ref) => resolveAssigneeUsers(ctx.tenantId, ref.type, ref.value)),
      );
      const resolved: ResolvedAssigneeUser[] = [];
      const seenIds = new Set<string>();
      for (const found of resolvedLists) {
        for (const u of found) {
          if (!seenIds.has(u.id)) {
            seenIds.add(u.id);
            resolved.push(u);
          }
        }
      }

      const assigneeType = refs.length === 1 ? refs[0].type : routerType;
      const assigneeId = refs.length === 1 ? refs[0].value : JSON.stringify(refs.map((r) => r.value));
      const assigneeUserIds = Array.from(seenIds);

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
        await logWfAction(schema, ctx.instanceId, ctx.stageId, 'task:no_assignee', ctx.session.userId, {
          taskId,
          routerType,
          routerValue,
          routerLabel,
          ruleId: matchedRuleId,
          refs: refs.map((r) => `${r.type}:${r.value}`),
        });
        return { success: true, output: { [`task_${ctx.stageId}`]: taskId, [`task_${ctx.stageId}_assignees`]: [] } };
      }

      await logWfAction(schema, ctx.instanceId, ctx.stageId, 'task:assigned', ctx.session.userId, {
        taskId,
        routerType,
        routerValue,
        routerLabel,
        ruleId: matchedRuleId,
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

export default approvalEventPlugin;
