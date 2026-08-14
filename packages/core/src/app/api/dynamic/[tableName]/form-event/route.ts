/**
 * POST /api/dynamic/[tableName]/form-event — Execute a form event chain
 *
 * Runs an action's pre-validations and ordered event sections inline (no
 * workflow instance). Each event is dispatched to its workflowEventRegistry
 * plugin (record / expression / script / notification) with the current record
 * + accumulated variables. Pre-validations gate the whole chain; section and
 * event conditions skip their step when false; a failed event stops the chain.
 * Runs under the same RLS/security pipeline as every dynamic API call.
 *
 * Body: {
 *   recordId?: string,              // current record (loaded fresh RLS-scoped)
 *   snapshot?: Record<string, any>, // optional pre-delete snapshot (delete actions)
 *   preValidations?: [{ expression, message }],  // JSONata gates — all must be truthy
 *   sections?: [{ condition?, events: [{ type, label?, condition?, storeAs?, config }] }],
 *   events?: [...]                  // legacy flat events (treated as one section)
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { QueryLayer } from '@/core/engine/QueryLayer';
import { resolveTable } from '@/lib/dynamicTable';
import format from 'pg-format';
import { requireSession } from '@/lib/auth/session';
import { workflowEventRegistry } from '@sails/plugin-sdk';
import { evaluateJsonata } from '@/core/engine/WorkflowHelpers';
import '@/core/plugins/init';

type RouteContext = { params: { tableName: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const session = await requireSession();
    const { recordId = null, snapshot = null, preValidations = [], sections = null, events = null } = await req.json();

    // Legacy flat `events` — treated as a single unconditional section.
    const chain: { condition?: string; events: any[] }[] = Array.isArray(sections)
      ? sections
      : (Array.isArray(events) ? [{ events }] : []);
    const hasAnyWork = chain.some((s) => (s.events || []).length > 0)
      || (Array.isArray(preValidations) && preValidations.length > 0);
    if (!hasAnyWork) {
      return NextResponse.json({ error: 'No events or pre-validations provided.' }, { status: 400 });
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
    const recordValues: Record<string, any> = record?.values || {};

    // ── Pre-validations: all must evaluate truthy ──
    if (Array.isArray(preValidations) && preValidations.length > 0) {
      const failures: { expression: string; message: string }[] = [];
      for (const pv of preValidations) {
        if (!pv?.expression) continue;
        const res = await evaluateJsonata(pv.expression, recordValues);
        if (!res.ok || !res.value) {
          failures.push({ expression: pv.expression, message: pv.message || 'Pre-validation failed.' });
        }
      }
      if (failures.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: failures[0].message || 'Pre-validation failed.',
            validationFailures: failures,
            results: [],
          },
          { status: 422 }
        );
      }
    }

    let variables: Record<string, any> = {};
    const results: any[] = [];

    for (const section of chain) {
      // Section condition: false skips the whole section (execution continues).
      if (section.condition) {
        const c = await evaluateJsonata(section.condition, recordValues);
        if (!c.ok || !c.value) {
          results.push({ sectionSkipped: true, condition: section.condition });
          continue;
        }
      }

      for (const event of section.events || []) {
        const type = event?.type;
        if (!type) continue;

        // Event condition: false skips just this event.
        if (event.condition) {
          const c = await evaluateJsonata(event.condition, recordValues);
          if (!c.ok || !c.value) {
            results.push({ type, label: event.label, skipped: true });
            continue;
          }
        }

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
            if (event.storeAs) {
              // Unwrap single-record outputs (e.g. Record Event results) so the
              // client can read fields directly for form-control mapping.
              const out = result.output;
              const st = event.config?.storeToVariable;
              variables[event.storeAs] = (out && st && typeof out === 'object' && st in out) ? out[st] : out;
            }
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
    }

    return NextResponse.json({ success: true, results, variables }, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to run form events.' }, { status });
  }
}
