/**
 * ComputedRecomputeWorker — drains core.computed_recompute_queue.
 *
 * The queue is fed by:
 *  - `core.enqueue_computed_change()` triggers on tables referenced by
 *    Expression fields (row-level, every write to the referenced table), and
 *  - `AlchemaCore.enqueueFullTableRecompute` (whole-table, when an Expression
 *    field is created or its formula changes).
 *
 * The worker recomputes affected rows as the table owner (raw pool, no RLS
 * role) so a low-privileged editor can never block system recomputation.
 * Recomputation is idempotent: rows whose computed values are unchanged are
 * skipped, and queue entries are deleted only after successful processing —
 * a crash between the two simply reprocesses the entry.
 */
import format from 'pg-format';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';
import { recomputeRow } from './ComputedFields';
import { quoteIdent } from './WorkflowHelpers';

const CHANNEL = 'sails_computed_recompute';
const ENTRY_BATCH = 200;
const FULL_TABLE_BATCH = 500;
const POLL_INTERVAL_MS = 5000;
const MISSING_TABLE_PATTERN = /relation "core\.computed_recompute_queue" does not exist/i;

let workerStarted = false;
let processing = false;

// ─── Metadata helpers ──────────────────────────────────────────

async function loadTableFields(schemaName: string, tableName: string): Promise<any[]> {
  const table = await db.tableDefinition.findFirst({
    where: { tableName, tenant: { schemaName } },
    include: { fields: true },
  });
  return table?.fields || [];
}

async function tenantIdForSchema(schemaName: string): Promise<string | null> {
  const tenant = await db.tenant.findUnique({ where: { schemaName }, select: { id: true } });
  return tenant?.id || null;
}

// ─── Queue processing ──────────────────────────────────────────

/**
 * Process one queue entry (single row or whole table). Returns the number of
 * rows whose stored computed values actually changed.
 */
async function processEntry(
  client: PoolClient,
  entry: { schema_name: string; table_name: string; record_id: string | null },
): Promise<number> {
  const { schema_name, table_name, record_id } = entry;
  // All fields are needed: relation resolution in the evaluation context
  // requires the relation field definitions, not just the expression fields.
  const fields = await loadTableFields(schema_name, table_name);
  if (!fields.some((f) => f.logicalType === 'expression')) {
    await client.query(
      'DELETE FROM core.computed_recompute_queue WHERE schema_name = $1 AND table_name = $2 AND record_id IS NOT DISTINCT FROM $3',
      [schema_name, table_name, record_id],
    );
    return 0;
  }

  // Capture the queue rows this recompute SUPERSEDES — entries enqueued AFTER
  // this snapshot (a write committing mid-recompute) must survive and be
  // processed by a later drain. Deleting "all rows for the target" instead
  // could silently drop a change that landed between the recompute's data
  // snapshot and its delete.
  const pending = await client.query(
    `SELECT id FROM core.computed_recompute_queue
      WHERE schema_name = $1 AND table_name = $2 AND record_id IS NOT DISTINCT FROM $3`,
    [schema_name, table_name, record_id],
  );
  const supersededIds = pending.rows.map((r: any) => r.id);

  let changed = 0;
  if (record_id) {
    const { changed: c } = await recomputeRow(client, schema_name, table_name, fields, record_id);
    changed = c ? 1 : 0;
  } else {
    // Whole-table pass — keyset pagination by id keeps memory constant.
    let lastId: string | null = null;
    for (;;) {
      const sql = lastId
        ? format('SELECT id FROM %I.%I WHERE id > %L ORDER BY id LIMIT %s', schema_name, table_name, lastId, FULL_TABLE_BATCH)
        : format('SELECT id FROM %I.%I ORDER BY id LIMIT %s', schema_name, table_name, FULL_TABLE_BATCH);
      const rows = await client.query(sql);
      for (const row of rows.rows) {
        const { changed: c } = await recomputeRow(client, schema_name, table_name, fields, row.id);
        if (c) changed++;
      }
      if (rows.rows.length < FULL_TABLE_BATCH) break;
      lastId = rows.rows[rows.rows.length - 1].id;
    }
  }

  // Clear only the rows this recompute superseded (captured before the
  // recompute) — never rows enqueued meanwhile.
  if (supersededIds.length > 0) {
    await client.query('DELETE FROM core.computed_recompute_queue WHERE id = ANY($1::text[])', [supersededIds]);
  }
  return changed;
}

/**
 * Drain as much of the queue as is available right now. Returns immediately
 * when another drain is in flight (single-worker guard).
 */
async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  let client: PoolClient | null = null;
  try {
    // connect() must live INSIDE the try/finally: a rejected connect would
    // otherwise leave `processing` true forever and silently disable the
    // worker until process restart.
    client = await pool.connect();
    // Batch summary audit: one data_audit_logs row per (tenant, table) per drain.
    const auditSummary = new Map<string, { tenantId: string; schema: string; table: string; changed: number }>();

    for (;;) {
      // Dedupe at DRAIN time, keeping the NEWEST pending row per target:
      // recomputing the newest entry always reflects the current data, and
      // once processed, ALL rows for that target are cleared (older rows are
      // obsolete). Processing the OLDEST row would race rapid follow-up
      // writes — its delete would discard the newer entry before that change
      // was ever recomputed.
      const entries = await client.query(
        `SELECT DISTINCT ON (schema_name, table_name, record_id) id, schema_name, table_name, record_id
           FROM core.computed_recompute_queue
          ORDER BY schema_name, table_name, record_id, created_at DESC
          LIMIT $1`,
        [ENTRY_BATCH],
      );
      if (entries.rows.length === 0) break;

      for (const entry of entries.rows) {
        await client.query('BEGIN');
        try {
          const changed = await processEntry(client, entry);
          const key = `${entry.schema_name}:${entry.table_name}`;
          const tenantId = await tenantIdForSchema(entry.schema_name);
          if (tenantId && changed > 0) {
            const existing = auditSummary.get(key);
            if (existing) existing.changed += changed;
            else auditSummary.set(key, { tenantId, schema: entry.schema_name, table: entry.table_name, changed });
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`[ComputedRecompute] Failed to recompute ${entry.schema_name}.${entry.table_name}/${entry.record_id || '*'} — will retry:`, error);
        }
      }

      // Stop when this batch didn't fill up (queue drained faster than writes arrive).
      if (entries.rows.length < ENTRY_BATCH) break;
    }

    for (const summary of auditSummary.values()) {
      const sql = format(
        `INSERT INTO core.data_audit_logs (id, tenant_id, user_id, action, object_name, record_id, old_values, new_values, created_at)
         VALUES (%L, %L, NULL, 'UPDATE', %L, NULL, NULL, %L, NOW())`,
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        summary.tenantId,
        summary.table,
        JSON.stringify({ recomputed: summary.changed, source: 'expression_engine' }),
      );
      await client.query(sql);
    }
  } catch (error: any) {
    if (!MISSING_TABLE_PATTERN.test(error?.message || '')) {
      console.error('[ComputedRecompute] Queue drain failed:', error);
    }
  } finally {
    processing = false;
    if (client) client.release();
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────

/**
 * Starts the recompute worker (idempotent). Runs a poll fallback plus a
 * LISTEN connection for instant wake-up on new queue entries.
 */
export function startComputedRecomputeWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  const schedulePoll = () => {
    setTimeout(() => {
      drainQueue()
        .catch(() => { /* guarded inside drainQueue */ })
        .finally(schedulePoll);
    }, POLL_INTERVAL_MS);
  };
  schedulePoll();

  const connectListener = () => {
    pool.connect()
      .then((client) => {
        client.on('notification', () => {
          drainQueue().catch(() => { /* guarded inside drainQueue */ });
        });
        client.on('error', () => {
          client.release();
          setTimeout(connectListener, POLL_INTERVAL_MS);
        });
        client.on('end', () => {
          setTimeout(connectListener, POLL_INTERVAL_MS);
        });
        client.query(`LISTEN ${quoteIdent(CHANNEL)}`).catch((error) => {
          console.warn('[ComputedRecompute] LISTEN failed:', error);
          client.release();
          setTimeout(connectListener, POLL_INTERVAL_MS);
        });
      })
      .catch((error) => {
        console.warn('[ComputedRecompute] Listener connection failed:', error);
        setTimeout(connectListener, POLL_INTERVAL_MS);
      });
  };
  connectListener();

  console.log('[ComputedRecompute] Worker started (queue drain + LISTEN).');
}
