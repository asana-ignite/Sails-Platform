/**
 * Plugin loader — builds the PluginSDK from core internals and loads
 * third-party plugins from the configured directory at startup.
 */
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PluginSDK } from '@sails/plugin-sdk';
import { workflowEventRegistry } from '@sails/plugin-sdk';
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { QueryLayer } from '../engine/QueryLayer';
import {
  evaluateJsonata,
  genId,
  logWfAction,
  quoteIdent,
  resolveTenantSchema,
} from '../engine/WorkflowHelpers';
import { preprocessFilterGroups } from '../engine/filterPreprocess';

export function buildPluginSDK(): PluginSDK {
  const q = QueryLayer as any;
  const p = pool as any;
  return {
    registry: {
      register: (plugin) => workflowEventRegistry.register(plugin),
    },
    query: {
      insertRecord: (tableName, tenantId, data, session) =>
        q.insertRecord(p, tenantId, tableName, data as any, session),
      updateRecord: (tableName, tenantId, id, data, session) =>
        q.updateRecord(p, tenantId, tableName, id, data as any, session),
      deleteRecord: (tableName, tenantId, id, session) =>
        q.deleteRecord(p, tenantId, tableName, id, session),
      upsertRecord: (tableName, tenantId, conflictKey, data, session) =>
        q.upsertRecord(p, tenantId, tableName, conflictKey, data as any, session),
      listRecords: (tableName, tenantId, filters, session) =>
        q.listRecords(p, tenantId, tableName, filters as any, session),
    },
    helpers: {
      evaluateJsonata,
      resolveTenantSchema,
      quoteIdent,
      genId,
      logWfAction: logWfAction as any,
      preprocessFilterGroups: preprocessFilterGroups as any,
    },
    db,
    pool,
  };
}

export function loadThirdPartyPlugins(
  pluginsDir: string,
  api: PluginSDK,
): void {
  if (!pluginsDir || !existsSync(pluginsDir)) return;

  const entries = readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const pluginPath = join(pluginsDir, entry.name);
      const mod = require(pluginPath);
      if (typeof mod.register === 'function') {
        mod.register(api);
        console.log(`[SAILS] Loaded plugin: ${entry.name}`);
      }
    } catch (err: any) {
      console.error(
        `[SAILS] Failed to load plugin '${entry.name}': ${err.message}`,
      );
    }
  }
}
