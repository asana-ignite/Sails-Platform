/**
 * WorkflowScheduler — in-process completion engine.
 *
 * A setInterval loop that drives every running workflow instance toward a
 * terminal state (completed / failed) via WorkflowEngine.proceedInstance.
 * Without it, instances with no approval tasks would never advance past the
 * first stage, and crash-stuck instances would stay 'running' forever.
 *
 * Multi-process safety: each tick takes a session-scoped pg advisory lock on
 * a dedicated pooled connection, so concurrent containers/processes never run
 * the same tick twice.
 */
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { quoteIdent } from './WorkflowHelpers';

const DEFAULT_TICK_MS = 15000;
const BATCH_LIMIT = 100;
const ADVISORY_LOCK_KEY = 0x5341494c; // 'SAIL'

let timer: NodeJS.Timeout | null = null;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    // Hold one connection for the advisory lock (session-scoped), release it
    // explicitly at the end of the tick.
    const client = await pool.connect();
    let locked = false;
    try {
      const lockRes = await client.query(`SELECT pg_try_advisory_lock($1) AS locked`, [ADVISORY_LOCK_KEY]);
      locked = lockRes.rows[0]?.locked === true;
      if (!locked) return; // another process is ticking

      const tenants = await db.tenant.findMany({ select: { id: true, schemaName: true } });
      for (const tenant of tenants) {
        if (!tenant.schemaName) continue;
        const s = quoteIdent(tenant.schemaName);

        let instances: { id: string }[] = [];
        try {
          const res = await pool.query(
            `SELECT id FROM ${s}.wf_instance WHERE state = 'running' ORDER BY updated_at ASC LIMIT $1`,
            [BATCH_LIMIT],
          );
          instances = res.rows;
        } catch {
          continue; // tenant has no workflow runtime tables yet
        }

        for (const inst of instances) {
          try {
            // Dynamic import avoids a module cycle (WorkflowEngine → plugins/init → scheduler).
            const { proceedInstance } = await import('./WorkflowEngine');
            await proceedInstance(tenant.id, inst.id);
          } catch (error: any) {
            // proceedInstance already marked the instance failed + logged it.
            console.error(`[WF-SCHEDULER] instance ${inst.id} (${tenant.schemaName}):`, error?.message || error);
          }
        }
      }
    } finally {
      if (locked) {
        await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]).catch(() => undefined);
      }
      client.release();
    }
  } catch (error: any) {
    console.error('[WF-SCHEDULER] tick failed:', error?.message || error);
  } finally {
    ticking = false;
  }
}

/** Start the completion scheduler (idempotent; no-op when already running). */
export function startWorkflowScheduler(intervalMs: number = DEFAULT_TICK_MS): void {
  if (timer) return;
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick(); // kick off immediately on boot
  console.log(`[WF-SCHEDULER] started (every ${intervalMs}ms)`);
}

export const WorkflowScheduler = { startWorkflowScheduler, tick };
export default WorkflowScheduler;
