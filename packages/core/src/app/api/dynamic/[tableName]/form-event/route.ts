/**
 * POST /api/dynamic/[tableName]/form-event — Execute a form event chain
 *
 * Runs an ordered list of FormEvents inline (no workflow instance): each event
 * is dispatched to its workflowEventRegistry plugin (record / expression /
 * script / notification) with the current record + accumulated variables.
 * A failed event stops the chain. Runs under the same RLS/security pipeline
 * as every dynamic API call.
 *
 * Body: {
 *   recordId?: string,              // current record (loaded fresh RLS-scoped)
 *   snapshot?: Record<string, any>, // optional pre-delete snapshot (delete actions)
 *   events: [{ type, label?, condition?, storeAs?, config }]
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { QueryLayer } from '@/core/engine/QueryLayer';
import { resolveTable } from '@/lib/dynamicTable';
import format from 'pg-format';
import { requireSession } from '@/lib/auth/session';
import { workflowEventRegistry } from '@sails/plugin-sdk';
import '@/core/plugins/init';

type RouteContext = { params: { tableName: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const session = await requireSession();
    const { recordId = null, snapshot = null, events = [] } = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'No events provided.' }, { status: 400 });
    }

    // Load the triggering record fresh (RLS-scoped) unless a snapshot is given
    // (used after a delete, where the record no longer exists).
    let record: { id: string | null; values: Record<string, any> } | null = null;
    if (snapshot && typeof snapshot === 'object') {
      record = { id: recordId, values: snapshot };
    } else if (recordId) {
      const resolved = await resolveTable(tableName);
      if (resolved) {
        record = await QueryLayer.executeSecureQuery(
          pool,
          tableName,
          'read',
          async (client) => {
            const sql = format('SELECT * FROM %I.%I WHERE id = $1', resolved.schemaName, tableName);
            const row = (await client.query(sql, [recordId])).rows[0];
            return row ? { id: row.id, values: row } : null;
          }
        );
      }
    }

    let variables: Record<string, any> = {};
    const results: any[] = [];

    for (const event of events) {
      const type = event?.type;
      if (!type) continue;

      let plugin;
      try {
        plugin = workflowEventRegistry.getPlugin(type);
      } catch {
        results.push({ type, label: event.label, success: false, error: 'Unknown event type.' });
        return NextResponse.json({ success: false, error: `Unknown event type: ${type}`, results }, { status: 422 });
      }

      const ctx: any = {
        tenantId: session.tenantId,
        instanceId: null,
        stageId: null,
        tableName: tableName || null,
        recordId: record?.id ?? null,
        record,
        operation: null,
        variables,
        variableDefs: [],
        session: { userId: session.userId, teamId: session.activeTeamId || null },
        timing: 'stage_enter',
        eventConfig: event.config || {},
      };

      try {
        const result = await plugin.execute(ctx);
        if (result?.output) {
          variables = { ...variables, ...result.output };
          if (event.storeAs) variables[event.storeAs] = result.output;
        }
        if (!result?.success) {
          results.push({ type, label: event.label, success: false, error: result?.error || 'Event failed.' });
          return NextResponse.json(
            { success: false, error: result?.error || `Event '${event.label || type}' failed.`, results },
            { status: 422 }
          );
        }
        results.push({ type, label: event.label, success: true, output: result?.output });
      } catch (error: any) {
        results.push({ type, label: event.label, success: false, error: error?.message || String(error) });
        return NextResponse.json(
          { success: false, error: `Event '${event.label || type}' failed: ${error?.message || String(error)}`, results },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ success: true, results, variables }, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to run form events.' }, { status });
  }
}
