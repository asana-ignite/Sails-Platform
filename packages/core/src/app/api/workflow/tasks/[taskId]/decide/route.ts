/**
 * Workflow Task Decision API — user-facing.
 *
 * POST /api/workflow/tasks/[taskId]/decide   body: { action, comment? }
 *
 * Records the assignee's vote via WorkflowEngine.advanceInstance, which
 * evaluates the stage's exit conditions and advances the instance (firing
 * stage_exit events, writing the execution log on completion). Re-voting is
 * idempotent — only the comment is updated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { pool } from '@/lib/knex';
import { quoteIdent, resolveTenantSchema } from '@/core/engine/WorkflowHelpers';
import { proceedInstance } from '@/core/engine/WorkflowEngine';

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const { userId, tenantId } = await requireSession();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const comment = body?.comment !== undefined && body?.comment !== null ? String(body.comment) : null;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    const schema = await resolveTenantSchema(tenantId);
    if (!schema) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(schema);

    const taskRes = await pool.query(
      `SELECT id, instance_id, step_id, status, assignee_users, actions
       FROM ${s}.wf_task WHERE id = $1 AND assignee_users @> $2::jsonb`,
      [params.taskId, JSON.stringify([userId])],
    );
    const task = taskRes.rows[0];
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    if (task.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Task already decided (${task.status})` }, { status: 409 });
    }

    const allowed: string[] = Array.isArray(task.actions)
      ? task.actions.map((a: any) => a?.value).filter((v: any): v is string => !!v)
      : [];
    if (allowed.length > 0 && !allowed.includes(action)) {
      return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
    }

    const result = await proceedInstance(tenantId, task.instance_id, {
      stepId: task.step_id,
      outcome: action,
      actorId: userId,
      comment,
    });

    return NextResponse.json({
      success: true,
      data: { state: result.state, taskId: task.id, instanceId: task.instance_id },
    });
  } catch (error: any) {
    console.error('[API WORKFLOW TASK DECIDE POST]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
