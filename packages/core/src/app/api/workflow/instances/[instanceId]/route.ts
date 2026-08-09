/**
 * Workflow Execution Detail API — admin-facing.
 *
 * GET /api/workflow/instances/[instanceId]
 *
 * Returns the wf_instance row, its wf_execution_log entry (when terminal),
 * all wf_task rows, the wf_action_log timeline with resolved actor names,
 * the definition name/table, and stage labels for task steps.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { quoteIdent, resolveTenantSchema } from '@/core/engine/WorkflowHelpers';

export async function GET(_req: NextRequest, { params }: { params: { instanceId: string } }) {
  try {
    const { tenantId } = await requireSession();
    const schema = await resolveTenantSchema(tenantId);
    if (!schema) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 500 });
    }
    const s = quoteIdent(schema);

    const instRes = await pool.query(
      `SELECT * FROM ${s}.wf_instance WHERE id = $1`,
      [params.instanceId],
    );
    const instance = instRes.rows[0];
    if (!instance) {
      return NextResponse.json({ success: false, error: 'Instance not found' }, { status: 404 });
    }

    const def = await db.workflowDefinition.findUnique({
      where: { id: instance.def_id },
      include: { table: { select: { tableName: true, name: true } } },
    });

    let dag: any = null;
    if (instance.version_id) {
      const version = await db.workflowVersion.findUnique({ where: { id: instance.version_id } });
      dag = version?.config || null;
    }
    if (!dag) dag = def?.publishedConfig || def?.config || null;

    const stageMap: Record<string, { id: string; label: string | null; description: string | null }> = {};
    for (const st of dag?.stages || []) {
      stageMap[st.id] = { id: st.id, label: st.label || null, description: st.description || null };
    }

    const [logRes, tasksRes, trailRes] = await Promise.all([
      pool.query(`SELECT * FROM ${s}.wf_execution_log WHERE instance_id = $1`, [params.instanceId]),
      pool.query(`SELECT * FROM ${s}.wf_task WHERE instance_id = $1 ORDER BY created_at ASC`, [params.instanceId]),
      pool.query(
        `SELECT id, step_id, action, actor_id, detail, created_at
         FROM ${s}.wf_action_log WHERE instance_id = $1 ORDER BY created_at ASC`,
        [params.instanceId],
      ),
    ]);

    // Resolve actor names (batched, one lookup).
    const actorIds = Array.from(
      new Set<string>(
        [
          ...trailRes.rows.map((r: any) => r.actor_id),
          ...tasksRes.rows.map((t: any) => t.decided_by),
          instance.created_by,
        ].filter(Boolean),
      ),
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
        instance: {
          id: instance.id,
          defId: instance.def_id,
          versionId: instance.version_id,
          state: instance.state,
          currentStepIds: instance.current_step_ids,
          vars: instance.vars,
          createdBy: instance.created_by,
          createdAt: instance.created_at,
          updatedAt: instance.updated_at,
          trigger: instance.trigger,
          recordId: instance.record_id,
          defName: def?.name || null,
          tableId: def?.tableId || null,
          tableName: def?.table?.tableName || null,
        },
        log: logRes.rows[0] || null,
        tasks: tasksRes.rows,
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
        stageMap,
        variableDefs: dag?.variables || [],
      },
    });
  } catch (error: any) {
    console.error('[API WORKFLOW INSTANCE DETAIL GET]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
