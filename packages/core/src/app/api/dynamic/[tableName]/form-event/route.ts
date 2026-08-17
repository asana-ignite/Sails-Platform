/**
 * POST /api/dynamic/[tableName]/form-event — Execute a form event chain
 *
 * Runs an action's pre-validations and ordered event sections inline (no
 * workflow instance). Each event is dispatched to its workflowEventRegistry
 * plugin (record / expression / script / notification / notification_message)
 * with the current record + accumulated variables. Section conditions skip
 * their step when their Query-Studio groups don't match; a failed event stops
 * the chain.
 *
 * Notification Message events PAUSE the chain: the plugin returns a
 * `notificationMessage` payload, the runner returns it to the client with
 * `paused: true` and the accumulated variables, and the events after it are
 * NOT executed yet. The client shows the modal and re-POSTs the same body
 * with `resume: { eventId, choice }` + `resumeVariables` (the paused
 * snapshot). choice 'cancel' stops the chain (later events never run);
 * 'confirm'/'ok' continues from the next event — the runner skips everything
 * before the resume point, so side effects never re-execute.
 *
 * Runs under the same RLS/security pipeline as every dynamic API call.
 *
 * Body: {
 *   recordId?: string,              // current record (loaded fresh RLS-scoped)
 *   snapshot?: Record<string, any>, // optional pre-delete snapshot (delete actions)
 *   sections?: [{ conditionGroups?, events: [{ type, label?, storeAs?, config }] }],
 *   events?: [...]                 // legacy flat events (treated as one section)
 *   resume?: { eventId: string; choice: 'confirm' | 'cancel' | 'ok' },
 *   resumeVariables?: Record<string, any>,  // variable snapshot from the paused run
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
import { evaluateFilterGroups } from '@sails/shared';
import { registerExpressionFunctions } from '@sails/shared';
import '@/core/plugins/init';

type RouteContext = { params: { tableName: string } };

interface FlatEvent {
  section: { conditionGroups?: any[]; events: any[] };
  event: any;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const session = await requireSession();
    const {
      recordId = null,
      snapshot = null,
      sections = null,
      events = null,
      variables: variableDecls = null,
      initialVariables = null,
      resume = null,
      resumeVariables = null,
    } = await req.json();

    // Legacy flat `events` — treated as a single unconditional section.
    const chain: { conditionGroups?: any[]; events: any[] }[] = Array.isArray(sections)
      ? sections
      : (Array.isArray(events) ? [{ events }] : []);
    const hasAnyWork = chain.some((s) => (s.events || []).length > 0);
    if (!hasAnyWork) {
      return NextResponse.json({ error: 'No events provided.' }, { status: 400 });
    }

    // Resume: locate the paused Notification Message event and validate it.
    let resumeIndex = -1;
    if (resume && typeof resume === 'object') {
      if (!resume.eventId || !resume.choice) {
        return NextResponse.json({ error: 'resume requires eventId and choice.' }, { status: 400 });
      }
      const flat = flattenChain(chain);
      const idx = flat.findIndex((f) => f.event?.id === resume.eventId);
      if (idx === -1) {
        return NextResponse.json({ error: 'resume event not found in the posted chain.' }, { status: 400 });
      }
      if (flat[idx].event?.type !== 'notification_message') {
        return NextResponse.json({ error: 'resume event is not a Notification Message.' }, { status: 400 });
      }
      resumeIndex = idx;
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

    const declaredVars: any[] = Array.isArray(variableDecls) ? variableDecls : [];
    // On resume the paused run's variable snapshot is the starting point; the
    // declared-variable initializers were already evaluated when we paused.
    let variables: Record<string, any> = resume
      ? { ...(resumeVariables && typeof resumeVariables === 'object' ? resumeVariables : {}) }
      : { ...(initialVariables && typeof initialVariables === 'object' ? initialVariables : {}) };
    if (!resume) {
      for (const v of declaredVars) {
        if (!v?.name) continue;
        if (variables[v.name] !== undefined) continue;
        let val: any = v.defaultValue;
        if (v.expression?.trim()) {
          const r = await evaluateJsonata(v.expression, { ...recordValues, vars: variables, variables });
          if (r.ok) val = r.value;
        }
        variables[v.name] = val;
      }
    }

    // Lazy field map (id → fieldName) for Query-Studio condition evaluation —
    // only resolved when any conditionGroups are present (keeps the light path).
    const chainHasRules = (chain || []).some((sec: any) =>
      Array.isArray(sec?.conditionGroups) && sec.conditionGroups.some((g: any) => (g?.rules || []).length > 0));
    let condFields: { id: string; fieldName: string }[] = [];
    if (!resume && tableName && chainHasRules) {
      try {
        const { resolveTableMeta } = await import('@/core/engine/WorkflowEventPlugins');
        const meta = await resolveTableMeta(session.tenantId, tableName);
        condFields = (meta?.table?.fields || []).map((f: any) => ({ id: f.id, fieldName: f.fieldName ?? f.id }));
      } catch { /* keep empty — group rules resolve by fieldName fallback */ }
    }

    const condUser = session
      ? { id: session.userId, role: session.role, email: session.email, activeTeamId: session.activeTeamId }
      : undefined;
    // Sync JSONata for the Expression f(x) source (shared evaluator is sync).
    const evalFilterExpression = (expr: string, input: any): any => {
      try {
        const jsonataLib = require('jsonata') as (e: string) => any;
        const fn = jsonataLib(expr);
        registerExpressionFunctions(fn);
        return fn.evaluate(input);
      } catch {
        return undefined;
      }
    };

    const results: any[] = [];

    // ── Execute the chain ──
    // Resume: skip everything up to (and including) the paused event — those
    // side effects already ran in the first request. choice 'cancel' stops
    // here; 'confirm'/'ok' continues from the next event. The resumed
    // section's condition already passed when the chain paused — it is NOT
    // re-evaluated (it could legitimately differ with resumed variables).
    const flat = flattenChain(chain);
    const startAt = resume ? resumeIndex + 1 : 0;
    const resumeSection = resume ? flat[resumeIndex]?.section ?? null : null;
    if (resume && resume.choice === 'cancel') {
      return NextResponse.json({ success: true, cancelled: true, results, variables, exposedVariables: {} }, { status: 200 });
    }

    for (let i = startAt; i < flat.length; i++) {
      const { section, event } = flat[i];
      const type = event?.type;
      if (!type) continue;

      // Section condition: skipped while the groups don't match (execution
      // continues). Skipped for the resumed section (already passed) on a resume.
      if (section !== resumeSection) {
        const secGroups = section.conditionGroups;
        if (Array.isArray(secGroups) && secGroups.some((g) => (g?.rules || []).length > 0)) {
          if (!(await evaluateFilterGroups(secGroups, { record: recordValues, vars: variables, fields: condFields as any, user: condUser, evaluateExpression: evalFilterExpression }))) {
            results.push({ sectionSkipped: true, conditionGroups: secGroups });
            // Skip the rest of this section.
            while (i + 1 < flat.length && flat[i + 1].section === section) i++;
            continue;
          }
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
        variableDefs: declaredVars,
        session: { userId: session.userId, teamId: session.activeTeamId || null },
        locale: (session as any).locale || 'en',
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
        // Notification Message → PAUSE: return the box + the variable snapshot;
        // the client resumes (confirm/ok/cancel) with the same chain body.
        if (result?.notificationMessage) {
          results.push({ type, label: event.label, success: true, paused: true });
          return NextResponse.json(
            {
              success: true,
              paused: true,
              notificationMessage: result.notificationMessage,
              resumeEventId: event.id,
              results,
              variables,
              exposedVariables: exposedOf(declaredVars, variables),
            },
            { status: 200 }
          );
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

    return NextResponse.json({ success: true, results, variables, exposedVariables: exposedOf(declaredVars, variables) }, { status: 200 });
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to run form events.' }, { status });
  }
}

/** Flatten sections into an ordered event list (preserving section grouping). */
function flattenChain(chain: { conditionGroups?: any[]; events: any[] }[]): FlatEvent[] {
  const flat: FlatEvent[] = [];
  for (const section of chain) {
    for (const event of section.events || []) {
      flat.push({ section, event });
    }
  }
  return flat;
}

/** Variables declared with exposeToForm — written back into form controls. */
function exposedOf(declaredVars: any[], variables: Record<string, any>): Record<string, any> {
  const exposed: Record<string, any> = {};
  for (const v of declaredVars) {
    if (v?.exposeToForm && v.name) exposed[v.name] = variables[v.name];
  }
  return exposed;
}
