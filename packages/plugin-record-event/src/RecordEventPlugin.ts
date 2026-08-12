/**
 * Record Event Plugin — standalone Workflow Event executor for CRUD operations.
 *
 * This is a first-party reference implementation that demonstrates the Plugin
 * SDK pattern.  It imports infrastructure from `sails-core` because it lives
 * in the monorepo; a third-party plugin would receive the `PluginSDK` via its
 * `register(api)` function (see `@sails/plugin-sdk`).
 */
import type {
  WorkflowEventPlugin,
  WorkflowEventContext,
  WorkflowEventResult,
} from '@sails/plugin-sdk';
import { db } from 'sails-core/src/lib/db';
import { pool } from 'sails-core/src/lib/knex';
import { QueryLayer } from 'sails-core/src/core/engine/QueryLayer';
import {
  buildPayload,
  buildSession,
  buildWorkflowCtx,
  getPath,
  resolveTableMeta,
  resolveTargetId,
  serializeRecordFilters,
  valueFor,
} from 'sails-core/src/core/engine/WorkflowEventPlugins';
import { evaluateJsonata, genId, logWfAction, quoteIdent, resolveTenantSchema } from 'sails-core/src/core/engine/WorkflowHelpers';
import {
  normalizeFilters,
  serializeFilterGroups,
  validateCollectionValue,
  validateRecordValue,
  WORKFLOW_EVENT_CONFIGS,
} from '@sails/shared';
import { preprocessFilterGroups } from 'sails-core/src/core/engine/filterPreprocess';
import type { WorkflowMacroCtx } from 'sails-core/src/core/engine/contextMacros';

function fail(ctx: WorkflowEventContext, error: string): WorkflowEventResult {
  return { success: false, error };
}

const BATCH_LIMIT = 500;

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
      const mapping = (eventConfig.fieldMapping || []) as any[];
      const needsWfCtx = mapping.some((m) => m.source === 'wf' || m.source === 'record_old');
      let workflowCtx: WorkflowMacroCtx | null = null;
      if (filterGroups.length > 0 || needsWfCtx) {
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
      let batchMode = false;

      if (operation === 'read') {
        const filters: Record<string, string> = {};
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

      else if (operation === 'create') {
        const payload = buildPayload(ctx, eventConfig, workflowCtx, meta.table.fields);
        const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
        if (idEntry) {
          const idVal = valueFor(ctx, idEntry, workflowCtx);
          if (idVal != null && idVal !== '') payload.id = idVal;
        }
        stored = await QueryLayer.insertRecord(pool, schema, model, payload, ses, meta.table.fields as any[]);
      }

      else if (operation === 'update') {
        const data = buildPayload(ctx, eventConfig, workflowCtx, meta.table.fields);
        const hasFilter = filterGroups.length > 0;
        if (hasFilter) {
          batchMode = true;
          const rows = await QueryLayer.listRecords(pool, schema, model, {
            filterGroups,
            limit: BATCH_LIMIT, page: 1,
            validFields: meta.validFields,
            textFields: meta.textFields,
            jsonbFields: meta.jsonbFields,
          });
          for (const row of rows.rows) {
            await QueryLayer.updateRecord(pool, schema, model, row.id, data, ses, meta.table.fields as any[]);
          }
        } else {
          const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
          const targetId = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
          if (!targetId) return fail(ctx, 'Record Event update requires a target record id (map a source onto the id column, or set a Record Filter)');
          stored = await QueryLayer.updateRecord(pool, schema, model, targetId, data, ses, meta.table.fields as any[]);
        }
      }

      else if (operation === 'upsert') {
        const mapping: any[] = eventConfig.fieldMapping || [];
        const idEntry = mapping.find((m) => m.targetCol === 'id');
        const idValue = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
        const payload: Record<string, any> = {};
        for (const m of mapping) {
          if (m.targetCol === 'id') continue;
          payload[m.targetCol] = valueFor(ctx, m, workflowCtx);
        }
        stored = await QueryLayer.upsertRecord(pool, schema, model, idValue, payload, ses, meta.table.fields as any[]);
      }

      else if (operation === 'delete') {
        const hasFilter = filterGroups.length > 0;
        if (hasFilter) {
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
          const idEntry = (eventConfig.fieldMapping || []).find((m: any) => m.targetCol === 'id');
          const targetId = idEntry ? (valueFor(ctx, idEntry, workflowCtx) as string) ?? null : resolveTargetId(ctx, eventConfig);
          if (!targetId) return fail(ctx, 'Record Event delete requires a target record id (map a source onto the id column, or set a Record Filter)');
          stored = await QueryLayer.deleteRecord(pool, schema, model, targetId, ses);
        }
      }

      else {
        return fail(ctx, `Operation '${operation}' is not supported`);
      }

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

export default recordEventPlugin;
