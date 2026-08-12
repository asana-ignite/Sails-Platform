/**
 * Tests for: date/time function library, live list aggregates, and the
 * $related() rollup (reverse-dependency recompute).
 * Self-contained — creates and drops its own throwaway tables.
 */
import { db } from '@/lib/db';
import { pool } from '@/lib/knex';
import { QueryLayer } from '@/core/engine/QueryLayer';
import { getTranslator } from '@/lib/services';
import { evaluateJsonata } from '@/core/engine/WorkflowHelpers';
import '@/core/plugins/init';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

function check(label: string, ok: boolean, extra?: any) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failures++;
}

async function waitFor(fn: () => Promise<boolean>, label: string, tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await sleep(500);
  }
  check(label, false);
  return false;
}

async function main() {
  // Oldest tenant (Sails Default) — matches the other expression tests.
  const tenant = await db.tenant.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  const schema = tenant.schemaName;
  const admin = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const ctx = {
    userId: admin.id,
    tenantId: tenant.id,
    role: 'SUPER_ADMIN' as const,
    email: admin.email,
    teams: [] as { teamId: string; isLeader: boolean }[],
    activeTeamId: undefined,
  };
  const tl = getTranslator();

  // Defensive: drop leftovers from a previously crashed run.
  for (const leftover of ['agg_demo', 'comp_child', 'comp_parent']) {
    const existing = await db.tableDefinition.findFirst({ where: { tableName: leftover, tenantId: tenant.id } });
    if (existing) await tl.removeTable(existing.id);
  }

  // ── 1. Date/time function library ────────────────────────────
  const dateCases: [string, any, any][] = [
    ["$addDays('2026-08-01T00:00:00Z', 30)", {}, '2026-08-31T00:00:00.000Z'],
    ["$diffDays('2026-08-01T00:00:00Z', '2026-08-11T00:00:00Z')", {}, 10],
    ["$formatDate('2026-08-01T00:00:00Z', 'dd/MM/yyyy')", {}, '01/08/2026'],
    ["$parseDate('14/02/2026', 'dd/MM/yyyy')", {}, '2026-02-14T00:00:00.000Z'],
    ["$startOfMonth('2026-08-15T10:00:00Z')", {}, '2026-08-01T00:00:00.000Z'],
    ["$addMonths('2026-01-31T00:00:00Z', 1)", {}, '2026-02-28T00:00:00.000Z'],
    ["$weekdayName('2026-08-11T00:00:00Z')", {}, 'Tuesday'],
    ["$isWeekend('2026-08-15T00:00:00Z')", {}, true],
    ["$addDays('not-a-date', 5)", {}, null],
    ["$addDays(null, 5)", {}, null],
    ["$formatDate('2026-08-01T00:00:00Z', 'yyyy-MM-dd HH:mm')", {}, '2026-08-01 00:00'],
    ["$ageYears('2000-01-01T00:00:00Z')", {}, 26],
  ];
  for (const [expr, input, expected] of dateCases) {
    const r = await evaluateJsonata(expr, input);
    check(`date fn: ${expr}`, r.ok && JSON.stringify(r.value) === JSON.stringify(expected), r.value);
  }

  // ── 2. Live aggregates via QueryLayer.listRecords ────────────
  const aggTable = await tl.createTable(tenant.id, 'Agg Demo', 'agg_demo');
  await tl.addFieldDef(aggTable.id, 'Amount', 'amount', 'number', 'number');
  await tl.addFieldDef(aggTable.id, 'Category', 'category', 'text', 'short_text');
  const rows = [
    await QueryLayer.insertRecord(pool, schema, 'agg_demo', { amount: 10, category: 'A' }, ctx),
    await QueryLayer.insertRecord(pool, schema, 'agg_demo', { amount: 20, category: 'A' }, ctx),
    await QueryLayer.insertRecord(pool, schema, 'agg_demo', { amount: 30, category: 'B' }, ctx),
  ];
  const fieldsOfAgg = await db.tableDefinition.findFirstOrThrow({ where: { id: aggTable.id }, include: { fields: true } });
  const validFields = new Set(fieldsOfAgg.fields.map((f) => f.fieldName));

  const aggResult = await QueryLayer.listRecords(pool, schema, 'agg_demo', {
    validFields, textFields: ['category'], limit: 1,
    aggregates: [
      { fieldName: 'amount', aggregate: 'sum' },
      { fieldName: 'amount', aggregate: 'avg' },
      { fieldName: 'amount', aggregate: 'max' },
      { fieldName: 'amount', aggregate: 'count' },
    ],
    ctx,
  });
  const byName = Object.fromEntries((aggResult.aggregates || []).map((a) => [`${a.aggregate}`, a.value]));
  check('aggregate SUM = 60', Number(byName.sum) === 60, byName.sum);
  check('aggregate AVG = 20', Number(byName.avg) === 20, byName.avg);
  check('aggregate MAX = 30', Number(byName.max) === 30, byName.max);
  check('aggregate COUNT = 3', Number(byName.count) === 3, byName.count);

  const filteredAgg = await QueryLayer.listRecords(pool, schema, 'agg_demo', {
    validFields, textFields: ['category'], limit: 1, filters: { category: 'A' },
    aggregates: [{ fieldName: 'amount', aggregate: 'sum' }],
    ctx,
  });
  check('aggregate respects filters (category A → 30)', Number(filteredAgg.aggregates?.[0]?.value) === 30, filteredAgg.aggregates?.[0]?.value);

  // ── 3. $related() rollup — reverse dependency recompute ──────
  const parentTable = await tl.createTable(tenant.id, 'Parent Demo', 'comp_parent');
  const childTable = await tl.createTable(tenant.id, 'Child Demo', 'comp_child');
  await tl.addFieldDef(childTable.id, 'Amount', 'amount', 'number', 'number');
  await tl.addFieldDef(childTable.id, 'Parent', 'parent_id', 'relation', 'relation', { targetTable: 'comp_parent' });
  const rollupField = await tl.addFieldDef(
    parentTable.id, 'Rollup Total', 'rollup_total', 'text', 'expression',
    { expression: "$sum($related('comp_child', 'parent_id').amount)", resultType: 'number' },
  );
  const deps = ((rollupField.config as any)?.dependencies) || [];
  check('reverse dependency detected', deps.some((d: any) => d.reverse && d.targetTable === 'comp_child' && d.relationField === 'parent_id'), deps);

  const revTrig = await pool.query(`SELECT 1 FROM pg_trigger WHERE tgname = 'trg_computed_rev_comp_parent_parent_id'`);
  check('reverse trigger created on child table', (revTrig.rowCount || 0) > 0);

  const parent = await QueryLayer.insertRecord(pool, schema, 'comp_parent', {}, ctx, await fieldsOf('comp_parent'));
  // JSONata $sum of an empty sequence is undefined → NULL (no children yet).
  check('rollup = NULL with no children', parent.rollup_total === null, parent.rollup_total);

  const c1 = await QueryLayer.insertRecord(pool, schema, 'comp_child', { amount: 40, parent_id: parent.id }, ctx);
  const c2 = await QueryLayer.insertRecord(pool, schema, 'comp_child', { amount: 60, parent_id: parent.id }, ctx);
  const seenValues: any[] = [];
  const sawSum = await waitFor(async () => {
    const res = await pool.query(`SELECT rollup_total FROM ${schema}.comp_parent WHERE id = '${parent.id}'`);
    seenValues.push(res.rows[0]?.rollup_total);
    return Number(res.rows[0]?.rollup_total) === 100;
  }, 'rollup recomputed after child inserts (40+60=100)');
  if (sawSum) check('rollup recomputed after child inserts (40+60=100)', true);
  else console.log('  seen values while polling:', JSON.stringify(seenValues));

  await QueryLayer.updateRecord(pool, schema, 'comp_child', c2.id, { amount: 160 }, ctx);
  const sawUpdate = await waitFor(async () => {
    const res = await pool.query(`SELECT rollup_total FROM ${schema}.comp_parent WHERE id = '${parent.id}'`);
    return Number(res.rows[0]?.rollup_total) === 200;
  }, 'rollup recomputed after child update (40+160=200)');
  if (sawUpdate) check('rollup recomputed after child update (40+160=200)', true);

  await QueryLayer.deleteRecord(pool, schema, 'comp_child', c1.id, ctx);
  const sawDelete = await waitFor(async () => {
    const res = await pool.query(`SELECT rollup_total FROM ${schema}.comp_parent WHERE id = '${parent.id}'`);
    return Number(res.rows[0]?.rollup_total) === 160;
  }, 'rollup recomputed after child delete (160)');
  if (sawDelete) check('rollup recomputed after child delete (160)', true);

  // ── 4. Invalid $related args never crash a write ─────────────
  const badField = await tl.addFieldDef(
    parentTable.id, 'Bad Rollup', 'bad_rollup', 'text', 'expression',
    { expression: '$sum($related(123, "x").amount)', resultType: 'number' },
  );
  const badParent = await QueryLayer.insertRecord(pool, schema, 'comp_parent', {}, ctx, await fieldsOf('comp_parent'));
  check('invalid $related args → NULL, write still succeeds', badParent.bad_rollup === null, badParent.bad_rollup);

  // ── Cleanup ──────────────────────────────────────────────────
  await tl.removeTable(childTable.id);
  await tl.removeTable(parentTable.id);
  await tl.removeTable(aggTable.id);
  console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

async function fieldsOf(tableName: string): Promise<any[]> {
  const t = await db.tableDefinition.findFirstOrThrow({
    where: { tableName, tenant: { schemaName: (await db.tenant.findFirstOrThrow({})).schemaName } },
    include: { fields: true },
  });
  return t.fields;
}

main().catch((e) => { console.error('CRASH', e); process.exit(1); });
