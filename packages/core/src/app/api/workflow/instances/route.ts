/**
 * Workflow Execution Log API — admin-facing runs list.
 *
 * GET /api/workflow/instances
 *   ?status=all|success|failed|running   (default all)
 *   ?defId=<id>                          filter by workflow definition
 *   ?search=<q>                          filter by workflow name
 *   ?page=&limit=
 *
 * Merges terminal entries from wf_execution_log (started_at / ended_at /
 * duration_ms / status / error) with live running instances from wf_instance
 * (running rows have no ended_at / duration yet).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { quoteIdent, resolveTenantSchema } from '@/core/engine/WorkflowHelpers';

interface Cond {
  sql: string;
  value?: any;
}

/** Render conditions with sequential placeholders starting at `start`. */
function renderConds(conds: Cond[], start: number): { sql: string; params: any[] } {
  let idx = start;
  const params: any[] = [];
  const parts = conds.map((c) => {
    if (c.value === undefined) return c.sql;
    idx += 1;
    params.push(c.value);
    return c.sql.replace(/\$X/g, `$${idx}`);
  });
  return { sql: parts.length ? parts.join(' AND ') : 'TRUE', params };
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireSession();
    const schema = await resolveTenantSchema(tenantId);
    if (!schema) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(schema);

    // Runtime tables may not exist yet for tenants with no engine activity.
    const [instOk, logOk] = await Promise.all([
      pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`${schema}.wf_instance`]),
      pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`${schema}.wf_execution_log`]),
    ]);
    if (instOk.rows[0]?.ok !== true) {
      return NextResponse.json({ success: true, data: { rows: [], total: 0, page: 1, limit: 20, totalPages: 0 } });
    }
    const hasLog = logOk.rows[0]?.ok === true;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const defId = searchParams.get('defId') || '';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '20')));

    // Workflow name lookup (search filter + running-row display names).
    const defs = await db.workflowDefinition.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const defMap = new Map(defs.map((d) => [d.id, d.name]));
    let defIds: string[] | null = null;
    if (search) {
      const matched = defs
        .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        .map((d) => d.id);
      if (matched.length === 0) {
        return NextResponse.json({ success: true, data: { rows: [], total: 0, page, limit, totalPages: 0 } });
      }
      defIds = matched;
    }

    // ── Filter conditions per branch ($X = placeholder token) ──
    const logConds: Cond[] = [];
    const runConds: Cond[] = [];

    if (status === 'success' || status === 'failed') {
      logConds.push({ sql: `el.status = $X`, value: status });
    } else if (status === 'running') {
      logConds.push({ sql: `1 = 0` });
    }
    if (!hasLog) logConds.push({ sql: `1 = 0` });
    if (defId) logConds.push({ sql: `el.def_id = $X`, value: defId });
    if (defIds) logConds.push({ sql: `el.def_id = ANY($X)`, value: defIds });

    if (status === 'running' || status === 'all') {
      runConds.push({ sql: `i.state = 'running'` });
      runConds.push({ sql: `NOT EXISTS (SELECT 1 FROM ${s}.wf_execution_log el2 WHERE el2.instance_id = i.id)` });
    } else {
      runConds.push({ sql: `1 = 0` });
    }
    if (defId) runConds.push({ sql: `i.def_id = $X`, value: defId });
    if (defIds) runConds.push({ sql: `i.def_id = ANY($X)`, value: defIds });

    const logR = renderConds(logConds, 0);
    const runR = renderConds(runConds, logR.params.length);

    const limitIdx = logR.params.length + runR.params.length + 1;
    const rowsRes = await pool.query(
      `SELECT * FROM (
         SELECT 'log' AS src, el.id AS log_id, el.instance_id, el.def_id,
                el.def_name, el.status, el.started_at, el.ended_at, el.duration_ms,
                el.error, el.stage_id, el.event_type, el.trigger, el.actor_id,
                el.record_id, el.events, el.created_at AS logged_at
         FROM ${s}.wf_execution_log el
         WHERE ${logR.sql}
         UNION ALL
         SELECT 'running' AS src, NULL::text, i.id, i.def_id, NULL::text,
                'running', i.created_at, NULL::timestamptz, NULL::bigint,
                NULL::text, NULL::text, NULL::text, i.trigger, i.created_by,
                i.record_id, NULL::jsonb, NULL::timestamptz
         FROM ${s}.wf_instance i
         WHERE ${runR.sql}
       ) x
       ORDER BY (x.src = 'running') DESC, x.started_at DESC NULLS LAST
       LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
      [...logR.params, ...runR.params, limit, (page - 1) * limit],
    );

    const [logCountRes, runCountRes] = await Promise.all([
      hasLog
        ? pool.query(`SELECT COUNT(*)::int AS n FROM ${s}.wf_execution_log el WHERE ${logR.sql}`, logR.params)
        : Promise.resolve({ rows: [{ n: 0 }] }),
      pool.query(`SELECT COUNT(*)::int AS n FROM ${s}.wf_instance i WHERE ${runR.sql}`, runR.params),
    ]);

    const total = (logCountRes.rows[0]?.n || 0) + (runCountRes.rows[0]?.n || 0);

    const rows = rowsRes.rows.map((r: any) => ({
      ...r,
      durationMs: r.duration_ms !== null && r.duration_ms !== undefined ? Number(r.duration_ms) : null,
      defName: r.def_name || defMap.get(r.def_id) || null,
    }));

    return NextResponse.json({
      success: true,
      data: { rows, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('[API WORKFLOW INSTANCES GET]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
