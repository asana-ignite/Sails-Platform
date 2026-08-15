/**
 * Smoke test for the Expression (computed) field type.
 * Runs against the LIVE dev DB — creates and drops its own throwaway tables.
 */
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { QueryLayer } from '@/core/engine/QueryLayer';
import { getTranslator } from '@/lib/services';
import '@/core/plugins/init'; // starts the recompute worker in-process

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function check(label: string, ok: boolean, extra?: any) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failures++;
}

const TABLE = 'computed_demo';
const RATE_TABLE = 'computed_rate';

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { schemaName: { not: undefined } }, orderBy: { createdAt: 'asc' } });
  const admin = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const schema = tenant.schemaName;

  const ctx = {
    userId: admin.id,
    tenantId: tenant.id,
    role: 'SUPER_ADMIN' as const,
    email: admin.email,
    teams: [] as { teamId: string; isLeader: boolean }[],
    activeTeamId: undefined,
    locale: 'en',
  };

  const tl = getTranslator();

  // ── 1. Set up throwaway tables ───────────────────────────────
  const rateTable = await tl.createTable(tenant.id, 'Computed Rate', RATE_TABLE);
  await tl.addFieldDef(rateTable.id, 'Rate', 'rate', 'number', 'number', { defaultValue: 10 });

  const demoTable = await tl.createTable(tenant.id, 'Computed Demo', TABLE);
  await tl.addFieldDef(demoTable.id, 'Unit Price', 'unit_price', 'number', 'number');
  await tl.addFieldDef(demoTable.id, 'Qty', 'qty', 'number', 'number');
  await tl.addFieldDef(demoTable.id, 'Rate Ref', 'rate_ref', 'relation', 'relation', { targetTable: RATE_TABLE });

  // Expression: same-row math
  const subtotalField = await tl.addFieldDef(
    demoTable.id, 'Subtotal', 'subtotal', 'text', 'expression',
    { expression: 'unit_price * qty', resultType: 'number' },
  );
  check('expression field created (config saved)', !!subtotalField.config, subtotalField.config);

  // Expression: cross-model reference
  const grandTotalField = await tl.addFieldDef(
    demoTable.id, 'Grand Total', 'grand_total', 'text', 'expression',
    { expression: 'unit_price * qty * rate_ref.rate', resultType: 'number' },
  );
  const deps = ((grandTotalField.config as any)?.dependencies) || [];
  check('cross-model dependency detected', deps.some((d: any) => d.targetTable === RATE_TABLE && d.relationField === 'rate_ref'), deps);

  // Expression: workflow-style `record.` prefix resolves to the record itself
  const prefixedField = await tl.addFieldDef(
    demoTable.id, 'Prefixed Total', 'prefixed_total', 'text', 'expression',
    { expression: 'record.unit_price * record.qty', resultType: 'number' },
  );
  check('record.-prefixed expression saved', ((prefixedField.config as any)?.referencedFields || []).includes('unit_price'), prefixedField.config);

  // ── 2. Same-record computation on insert ─────────────────────
  const rate = await QueryLayer.insertRecord(pool, schema, RATE_TABLE, { rate: 10 }, ctx);
  const demo1 = await QueryLayer.insertRecord(pool, schema, TABLE, { unit_price: 5, qty: 3, rate_ref: rate.id }, ctx, await fieldsOf(schema, TABLE));
  check('subtotal computed on insert (5*3=15)', Number(demo1.subtotal) === 15, demo1.subtotal);
  check('grand_total computed on insert (5*3*10=150)', Number(demo1.grand_total) === 150, demo1.grand_total);

  // Client-supplied computed values are ignored
  const demo2 = await QueryLayer.insertRecord(pool, schema, TABLE, { unit_price: 2, qty: 4, rate_ref: rate.id, subtotal: 999, grand_total: 999 }, ctx, await fieldsOf(schema, TABLE));
  check('client-supplied computed values overridden', Number(demo2.subtotal) === 8 && Number(demo2.grand_total) === 80, { subtotal: demo2.subtotal, grand_total: demo2.grand_total });

  // record.-prefixed expression evaluates against the record
  const demo3 = await QueryLayer.insertRecord(pool, schema, TABLE, { unit_price: 3, qty: 7 }, ctx, await fieldsOf(schema, TABLE));
  check('record.-prefixed expression computed on insert (3*7=21)', Number(demo3.prefixed_total) === 21, demo3.prefixed_total);

  // ── 3. Same-record recompute on update ───────────────────────
  const updated = await QueryLayer.updateRecord(pool, schema, TABLE, demo1.id, { qty: 10 }, ctx, await fieldsOf(schema, TABLE));
  check('subtotal recomputed on update (5*10=50)', Number(updated.subtotal) === 50, updated.subtotal);
  check('grand_total recomputed on update (5*10*10=500)', Number(updated.grand_total) === 500, updated.grand_total);

  // ── 4. Cross-model recompute via trigger + worker (raw SQL write) ──
  await pool.query(`UPDATE ${schema}.${RATE_TABLE} SET rate = 100 WHERE id = '${rate.id}'`);
  let sawRecompute = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const res = await pool.query(`SELECT grand_total FROM ${schema}.${TABLE} WHERE id = '${demo1.id}'`);
    if (Number(res.rows[0]?.grand_total) === 5000) { sawRecompute = true; break; }
  }
  check('cross-model recompute after related-record change (5*10*100=5000)', sawRecompute);
  const res2 = await pool.query(`SELECT grand_total FROM ${schema}.${TABLE} WHERE id = '${demo2.id}'`);
  check('second dependent row recomputed (2*4*100=800)', Number(res2.rows[0]?.grand_total) === 800, res2.rows[0]?.grand_total);

  // ── 4b. Related record DELETED → FK SET NULL → recompute to NULL ──
  await QueryLayer.deleteRecord(pool, schema, RATE_TABLE, rate.id, ctx);
  let sawDeleteRecompute = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const res = await pool.query(`SELECT grand_total FROM ${schema}.${TABLE} WHERE id = '${demo1.id}'`);
    if (res.rows[0]?.grand_total === null) { sawDeleteRecompute = true; break; }
  }
  check('cross-model recompute after related-record delete (grand_total → NULL)', sawDeleteRecompute);

  // ── 5. Expression error → NULL (not a write failure) ─────────
  const bad = await QueryLayer.insertRecord(pool, schema, TABLE, { qty: 2 }, ctx, await fieldsOf(schema, TABLE));
  check('missing field → NULL, write still succeeds', bad.subtotal === null && bad.grand_total === null, { subtotal: bad.subtotal, grand_total: bad.grand_total });

  // ── 6. Invalid expression blocked at field creation ──────────
  let blocked = false;
  try {
    await tl.addFieldDef(demoTable.id, 'Broken', 'broken_expr', 'text', 'expression', { expression: 'unit_price *', resultType: 'number' });
  } catch (e: any) {
    blocked = e.message.includes('Invalid JSONata');
  }
  check('invalid JSONata blocked at field creation', blocked);

  // ── 7. Expression-on-expression references blocked ───────────
  let exprRefBlocked = false;
  try {
    await tl.addFieldDef(demoTable.id, 'Refs Expr', 'refs_expr', 'text', 'expression', { expression: 'subtotal * 2', resultType: 'number' });
  } catch (e: any) {
    exprRefBlocked = e.message.includes('cannot reference another Expression');
  }
  check('expression-on-expression references blocked', exprRefBlocked);

  // ── 8. Deleting a referenced field is blocked ────────────────
  let delBlocked = false;
  try {
    await tl.removeFieldDef((await db.fieldDefinition.findFirstOrThrow({ where: { tableId: demoTable.id, fieldName: 'qty' } })).id);
  } catch (e: any) {
    delBlocked = e.message.includes('referenced by the Expression field');
  }
  check('deleting a field referenced by an expression blocked', delBlocked);

  // ── 9. Column types match result types ───────────────────────
  const cols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${TABLE}' AND column_name IN ('subtotal','grand_total')`
  );
  const numericCols = cols.rows.every((r: any) => r.data_type === 'numeric');
  check('expression columns stored as NUMERIC', numericCols, cols.rows);

  // ── Cleanup ──────────────────────────────────────────────────
  await tl.removeTable(demoTable.id);
  await tl.removeTable(rateTable.id);
  console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

async function fieldsOf(schemaName: string, tableName: string): Promise<any[]> {
  const t = await db.tableDefinition.findFirstOrThrow({
    where: { tableName, tenant: { schemaName } },
    include: { fields: true },
  });
  return t.fields;
}

main().catch((e) => {
  console.error('SMOKE TEST CRASHED:', e);
  process.exit(1);
});
