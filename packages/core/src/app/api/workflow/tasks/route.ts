/**
 * Workflow Task Inbox API — user-facing.
 *
 * GET /api/workflow/tasks                  → my tasks (pending by default)
 * GET /api/workflow/tasks?count=true       → pending count (badge)
 * GET /api/workflow/tasks?status=decided   → tasks I already decided
 * GET /api/workflow/tasks?status=all       → everything assigned to me
 * GET /api/workflow/tasks?defId=<id>       → filter by workflow definition
 * GET /api/workflow/tasks?search=<q>       → filter by workflow name
 * GET /api/workflow/tasks?overdue=true     → only overdue pending tasks
 *
 * Scoped to the current user: only tasks whose `assignee_users` contains the
 * session user id are returned. Data lives in tenant schemas (wf_task joined
 * with wf_instance) and core.workflow_definitions for display names.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { quoteIdent, resolveTenantSchema } from '@/core/engine/WorkflowHelpers';

const TASK_COLUMNS = `
  t.id, t.instance_id, t.step_id, t.status, t.assignee_type, t.assignee_id,
  t.assignee_users, t.decisions, t.actions, t.due_at, t.decided_by, t.decision,
  t.decided_at, t.created_at,
  i.def_id, i.state AS instance_state,
  d.name AS def_name`;

export async function GET(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireSession();
    const schema = await resolveTenantSchema(tenantId);
    if (!schema) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(schema);

    // Table may not exist yet for tenants with no runtime activity.
    const exists = await pool
      .query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`${schema}.wf_task`])
      .then((r) => r.rows[0]?.ok === true)
      .catch(() => false);
    if (!exists) {
      return NextResponse.json({ success: true, data: { rows: [], total: 0, page: 1, limit: 20, totalPages: 0 } });
    }

    const { searchParams } = new URL(req.url);
    const countOnly = searchParams.get('count') === 'true';
    const status = searchParams.get('status') || 'pending';
    const defId = searchParams.get('defId') || '';
    const search = searchParams.get('search') || '';
    const overdue = searchParams.get('overdue') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '20')));

    const params: any[] = [JSON.stringify([userId])];
    const where: string[] = [`t.assignee_users @> $1::jsonb`];
    const param = (v: any): string => {
      params.push(v);
      return `$${params.length}`;
    };

    if (status === 'pending') where.push(`t.status = 'pending'`);
    else if (status === 'decided') where.push(`t.status <> 'pending'`);
    if (defId) where.push(`i.def_id = ${param(defId)}`);
    if (overdue) where.push(`t.status = 'pending' AND t.due_at IS NOT NULL AND t.due_at < now()`);
    if (search) {
      const escaped = search.replace(/[%_\\]/g, (c) => `\\${c}`);
      where.push(`d.name ILIKE ${param(`%${escaped}%`)} ESCAPE '\\'`);
    }

    const whereSql = where.join(' AND ');
    const fromSql = `
      FROM ${s}.wf_task t
      JOIN ${s}.wf_instance i ON i.id = t.instance_id
      JOIN core.workflow_definitions d ON d.id = i.def_id AND d.tenant_id = ${param(tenantId)}`;

    if (countOnly) {
      const res = await pool.query(
        `SELECT COUNT(*)::int AS n ${fromSql} WHERE ${whereSql}`,
        params,
      );
      return NextResponse.json({ success: true, data: { count: res.rows[0]?.n || 0 } });
    }

    const [rowsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${TASK_COLUMNS} ${fromSql} WHERE ${whereSql}
         ORDER BY (t.status = 'pending') DESC, t.due_at ASC NULLS LAST, t.created_at DESC
         LIMIT ${param(limit)} OFFSET ${param((page - 1) * limit)}`,
        params,
      ),
      pool.query(`SELECT COUNT(*)::int AS n ${fromSql} WHERE ${whereSql}`, params),
    ]);

    const total = countRes.rows[0]?.n || 0;
    return NextResponse.json({
      success: true,
      data: {
        rows: rowsRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[API WORKFLOW TASKS GET]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
