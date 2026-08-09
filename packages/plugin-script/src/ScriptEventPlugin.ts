import type { WorkflowEventPlugin } from '@sails/plugin-sdk';
import { db } from 'sails-core/src/lib/db';
import { fail } from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { logWfAction } from 'sails-core/src/core/engine/WorkflowHelpers';
import { executeScript, SandboxContext } from 'sails-core/src/core/engine/ScriptSandbox';
import { validateCollectionValue, validateRecordValue, WORKFLOW_EVENT_CONFIGS } from '@sails/shared';

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

export default scriptEventPlugin;
