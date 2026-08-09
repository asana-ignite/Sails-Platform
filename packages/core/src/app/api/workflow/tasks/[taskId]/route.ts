/**
 * Workflow Task Detail API — user-facing.
 *
 * GET /api/workflow/tasks/[taskId]
 *
 * Returns everything the Approval Page needs:
 *   - the wf_task row (assignees, actions, decisions, due date)
 *   - the wf_instance row (state, vars, trigger, record)
 *   - the workflow definition + pinned-version stage config (label, description,
 *     approval event config: message, attachments, detailLayout)
 *   - the action-history timeline (wf_action_log) with resolved actor names
 *   - the DAG's variable definitions for rendering variables
 *
 * Only the task's assignees may read it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { quoteIdent, resolveTenantSchema } from '@/core/engine/WorkflowHelpers';

export async function GET(_req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const { userId, tenantId } = await requireSession();
    const schema = await resolveTenantSchema(tenantId);
    if (!schema) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(schema);

    const taskRes = await pool.query(
      `SELECT * FROM ${s}.wf_task WHERE id = $1 AND assignee_users @> $2::jsonb`,
      [params.taskId, JSON.stringify([userId])],
    );
    const task = taskRes.rows[0];
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const instRes = await pool.query(
      `SELECT * FROM ${s}.wf_instance WHERE id = $1`,
      [task.instance_id],
    );
    const instance = instRes.rows[0];
    if (!instance) {
      return NextResponse.json({ success: false, error: 'Workflow instance not found' }, { status: 404 });
    }

    const def = await db.workflowDefinition.findUnique({
      where: { id: instance.def_id },
      include: { table: { select: { tableName: true, name: true } } },
    });

    // Frozen DAG from the version snapshot (or live config fallback for NULL).
    let dag: any = null;
    if (instance.version_id) {
      const version = await db.workflowVersion.findUnique({ where: { id: instance.version_id } });
      dag = version?.config || null;
    }
    if (!dag) dag = def?.publishedConfig || def?.config || null;

    const stage = (dag?.stages || []).find((st: any) => st.id === task.step_id) || null;
    const approvalEvent = stage?.events?.find((ev: any) => ev.type === 'approval') || null;

    const [trailRes] = await Promise.all([
      pool.query(
        `SELECT id, step_id, action, actor_id, detail, created_at
         FROM ${s}.wf_action_log WHERE instance_id = $1 ORDER BY created_at ASC`,
        [task.instance_id],
      ),
    ]);

    // Resolve actor names for the timeline (batched, one lookup).
    const actorIds = Array.from(
      new Set<string>([
        ...trailRes.rows.map((r: any) => r.actor_id).filter(Boolean),
        instance.created_by,
        task.decided_by,
      ].filter(Boolean)),
    );
    const users: Record<string, { id: string; name: string | null; email: string | null }> = {};
    if (actorIds.length > 0) {
      const found = await db.user.findMany({
        where: { tenantId, id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      });
      for (const u of found) users[u.id] = u;
    }

    return NextResponse.json({
      success: true,
      data: {
        task,
        instance: {
          id: instance.id,
          state: instance.state,
          vars: instance.vars,
          createdBy: instance.created_by,
          createdAt: instance.created_at,
          trigger: instance.trigger,
          recordId: instance.record_id,
          defName: def?.name || null,
          tableId: def?.tableId || null,
          tableName: def?.table?.tableName || null,
        },
        stage: stage
          ? { id: stage.id, label: stage.label || null, description: stage.description || null }
          : null,
        approvalEvent: approvalEvent?.config || null,
        timeline: trailRes.rows.map((r: any) => ({
          id: r.id,
          stepId: r.step_id,
          action: r.action,
          actorId: r.actor_id,
          actorName: r.actor_id ? users[r.actor_id]?.name || null : null,
          detail: r.detail,
          createdAt: r.created_at,
        })),
        users,
        variableDefs: dag?.variables || [],
      },
    });
  } catch (error: any) {
    console.error('[API WORKFLOW TASK DETAIL GET]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
