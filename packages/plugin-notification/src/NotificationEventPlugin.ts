/**
 * NotificationEventPlugin — bell + email notification event executor.
 */
import type { WorkflowEventPlugin } from '@sails/plugin-sdk';
import { fail, referencesWorkflowContext, buildWorkflowCtx } from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { resolveTenantSchema, logWfAction } from 'sails-core/src/core/engine/WorkflowHelpers';
import { deliverWorkflowNotification } from 'sails-core/src/core/engine/notifications';
import { WORKFLOW_EVENT_CONFIGS } from '@sails/shared';

const notificationEventPlugin: WorkflowEventPlugin = {
  type: 'notification',
  label: 'Notification',
  description: 'Send bell / email notifications to resolved recipients',
  parametersSchema: WORKFLOW_EVENT_CONFIGS.notification,
  async execute(ctx) {
    const { eventConfig } = ctx;
    const channel = (['email', 'bell', 'both'].includes(eventConfig.channel as string) ? eventConfig.channel : 'bell') as 'email' | 'bell' | 'both';
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

export default notificationEventPlugin;
