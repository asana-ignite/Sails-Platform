/**
 * ComputedFields — evaluation engine for the `expression` field type.
 *
 * An expression field stores a JSONata formula (`config.expression`) plus a
 * result type (`config.resultType`). The value is computed server-side:
 *
 *  - synchronously on every create/update of the record itself (QueryLayer),
 *  - asynchronously via the recompute worker when a *related* record that the
 *    expression references changes (cross-model recompute).
 *
 * The evaluation context is the record's own fields plus any related record
 * reachable through the record's relation fields (fetched in the same
 * transaction / client). Unknown references evaluate to JSONata's undefined —
 * they never crash a write; failures store NULL.
 */
import format from 'pg-format';
import type { PoolClient } from 'pg';
import { evaluateJsonata } from './WorkflowHelpers';
import type { ExpressionFieldDependency, ExpressionFunction } from '@sails/shared';
// Coercion + result-type resolution live in shared so the console's live form
// preview applies exactly the semantics the server uses when storing values.
import { coerceExpressionResult, expressionResultType, type ExpressionResultType } from '@sails/shared';

export type { ExpressionResultType };
export { coerceExpressionResult, expressionResultType };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonataLib: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('jsonata');
  } catch {
    return null;
  }
})();

const parserFn: ((expr: string) => any) | null = jsonataLib?.parser || null;

export const EXPRESSION_RESULT_PG_TYPES: Record<ExpressionResultType, string> = {
  number: 'NUMERIC',
  text: 'VARCHAR(255)',
  boolean: 'BOOLEAN',
  date: 'TIMESTAMPTZ',
};

export function isExpressionField(field: any): boolean {
  return (field.logicalType || '').toLowerCase() === 'expression';
}

// ─── AST analysis ──────────────────────────────────────────────

function walkNames(node: any, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'name' && typeof node.value === 'string') {
    out.add(node.value);
    return;
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walkNames(item, out);
    } else if (child && typeof child === 'object') {
      walkNames(child, out);
    }
  }
}

/**
 * Parse a JSONata expression and derive:
 *  - parse errors (invalid formula → field cannot be saved),
 *  - `referencedFields`: every referenced name matching a field of the table
 *    (drives the delete-guard — a field used by a formula cannot be removed),
 *  - cross-model dependencies: every referenced relation/lookup field of the
 *    table (v1: forward references only) — drives the recompute triggers,
 *    plus `$related('child_table', 'fk')` rollup calls (reverse dependencies),
 *  - expression-on-expression references, which are rejected in v1.
 */
export function analyzeExpression(
  expression: string,
  tableFields: any[],
): {
  ok: boolean;
  error?: string;
  dependencies?: ExpressionFieldDependency[];
  referencedFields?: string[];
  warnings?: string[];
} {
  const trimmed = (expression || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Expression is required.' };
  }
  if (!parserFn) {
    return { ok: false, error: 'JSONata parser is not available — add the jsonata dependency to sails-core' };
  }

  let ast: any;
  try {
    ast = parserFn(trimmed);
  } catch (e: any) {
    return { ok: false, error: `Invalid JSONata expression: ${e?.message || String(e)}` };
  }

  const referenced = new Set<string>();
  walkNames(ast, referenced);

  const dependencies: ExpressionFieldDependency[] = [];
  const referencedFields: string[] = [];
  const warnings: string[] = [];

  for (const name of referenced) {
    const field = tableFields.find((f) => f.fieldName === name);
    if (!field) continue; // nested step inside a related record — resolves against that record

    if (isExpressionField(field)) {
      return {
        ok: false,
        error: `Expression fields cannot reference another Expression field ('${name}'). Combine the formulas into a single expression instead.`,
      };
    }

    referencedFields.push(name);

    const isRelation =
      field.logicalType === 'relation' ||
      field.logicalType === 'lookup' ||
      field.physicalType === 'relation';
    if (isRelation) {
      const targetTable = (field.config as any)?.targetTable;
      if (targetTable) {
        dependencies.push({ targetTable, relationField: name });
      } else {
        warnings.push(`Relation field '${name}' has no target table configured — references to it will evaluate to empty.`);
      }
    }
  }

  // $related('child_table', 'fk_field') rollup calls → reverse dependencies.
  for (const dep of findRelatedCalls(ast)) {
    if (!dependencies.some((d) => d.reverse && d.targetTable === dep.targetTable && d.relationField === dep.relationField)) {
      dependencies.push({ ...dep, reverse: true });
    }
  }

  return { ok: true, dependencies, referencedFields, warnings };
}

interface RelatedCall {
  targetTable: string;
  relationField: string;
}

/** Walk the AST for `$related('child_table', 'fk_field')` function calls. */
function findRelatedCalls(node: any, out: RelatedCall[] = []): RelatedCall[] {
  if (!node || typeof node !== 'object') return out;
  if (
    node.type === 'function' &&
    node.procedure?.type === 'variable' &&
    node.procedure?.value === 'related' &&
    Array.isArray(node.arguments)
  ) {
    const [tableArg, fieldArg] = node.arguments;
    if (
      tableArg?.type === 'string' && typeof tableArg.value === 'string' &&
      fieldArg?.type === 'string' && typeof fieldArg.value === 'string' &&
      /^[a-z][a-z0-9_]*$/.test(tableArg.value) &&
      /^[a-z][a-z0-9_]*$/.test(fieldArg.value)
    ) {
      out.push({ targetTable: tableArg.value, relationField: fieldArg.value });
    }
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) findRelatedCalls(item, out);
    } else if (child && typeof child === 'object') {
      findRelatedCalls(child, out);
    }
  }
  return out;
}

// ─── Evaluation ────────────────────────────────────────────────

/**
 * Build the JSONata evaluation context for a record: the record's own fields
 * plus nested related records reached through its relation fields.
 */
export async function buildEvaluationContext(
  client: PoolClient,
  schemaName: string,
  tableName: string,
  fields: any[],
  record: Record<string, any>,
): Promise<Record<string, any>> {
  const ctx: Record<string, any> = { ...record };
  // Workflow-style references (`record.<field>`) are also accepted — expose the
  // record under `record` unless a field literally named `record` exists.
  if (!fields.some((f) => f.fieldName === 'record')) {
    ctx.record = { ...record };
  }

  const relationFields = fields.filter(
    (f) =>
      (f.logicalType === 'relation' || f.logicalType === 'lookup' || f.physicalType === 'relation') &&
      (f.config as any)?.targetTable,
  );
  if (relationFields.length === 0) return ctx;

  // Group referenced ids by target table → one batched query per target table.
  const byTarget = new Map<string, { field: any; ids: Set<string> }>();
  for (const f of relationFields) {
    const id = record[f.fieldName];
    if (!id) {
      ctx[f.fieldName] = null;
      continue;
    }
    const target = (f.config as any).targetTable as string;
    let group = byTarget.get(target);
    if (!group) {
      group = { field: f, ids: new Set() };
      byTarget.set(target, group);
    }
    group.ids.add(id);
  }

  for (const [target, group] of byTarget.entries()) {
    try {
      const sql = format(
        'SELECT * FROM %I.%I WHERE id = ANY($1::text[])',
        schemaName,
        target,
      );
      const result = await client.query(sql, [Array.from(group.ids)]);
      const byId = new Map(result.rows.map((r: any) => [r.id, r]));
      // Nest the related record under the relation field name.
      for (const f of relationFields.filter((ff) => (ff.config as any).targetTable === target)) {
        const id = record[f.fieldName];
        ctx[f.fieldName] = id ? byId.get(id) || null : null;
      }
    } catch (e) {
      console.warn(`[ComputedFields] Failed to load related records for ${schemaName}.${target}:`, e);
      for (const f of relationFields.filter((ff) => (ff.config as any).targetTable === target)) {
        ctx[f.fieldName] = null;
      }
    }
  }

  return ctx;
}

/**
 * Evaluate every expression field of a table against the given record.
 * Returns an overlay of `{ [fieldName]: coercedValue }` plus any errors.
 * A failing expression stores NULL — it never blocks the write.
 */
export async function computeRecordExpressions(
  client: PoolClient,
  schemaName: string,
  tableName: string,
  fields: any[],
  record: Record<string, any>,
): Promise<{ values: Record<string, any>; errors: string[] }> {
  const values: Record<string, any> = {};
  const errors: string[] = [];

  const expressionFields = fields.filter(isExpressionField);
  if (expressionFields.length === 0) return { values, errors };

  const ctx = await buildEvaluationContext(client, schemaName, tableName, fields, record);

  // $related('child_table', 'fk_field') — rollup: every child row whose FK
  // points at this record. Runs inside the caller's client so RLS applies
  // (users can only roll up rows they can read); never throws — a failed
  // lookup yields an empty list.
  const extraFunctions: Record<string, ExpressionFunction> = {
    related: async (childTable: unknown, fkField: unknown): Promise<any[]> => {
      if (typeof childTable !== 'string' || typeof fkField !== 'string') return [];
      if (!/^[a-z][a-z0-9_]*$/.test(childTable) || !/^[a-z][a-z0-9_]*$/.test(fkField)) return [];
      try {
        const result = await client.query(
          format('SELECT * FROM %I.%I WHERE %I = $1', schemaName, childTable, fkField),
          [record.id],
        );
        return result.rows;
      } catch (e) {
        console.warn(`[ComputedFields] $related('${childTable}', '${fkField}') failed:`, e);
        return [];
      }
    },
  };

  for (const field of expressionFields) {
    const config = (field.config || {}) as any;
    const expression = typeof config.expression === 'string' ? config.expression.trim() : '';
    if (!expression) {
      values[field.fieldName] = null;
      continue;
    }
    const result = await evaluateJsonata(expression, ctx, extraFunctions);
    if (!result.ok || result.value === undefined) {
      if (result.error) {
        errors.push(`Field '${field.name}': ${result.error}`);
      }
      values[field.fieldName] = null;
      continue;
    }
    try {
      values[field.fieldName] = coerceExpressionResult(result.value, expressionResultType(field));
    } catch (e: any) {
      errors.push(`Field '${field.name}': ${e?.message || String(e)}`);
      values[field.fieldName] = null;
    }
  }

  return { values, errors };
}

// ─── Recompute helpers (used by the worker) ────────────────────

/**
 * Recompute every expression field of one row in place, returning the
 * updated row and whether a write occurred. Runs with the calling client's
 * privileges — the worker uses an owner-privileged client (no RLS role) so
 * system recompute never fails. Values that are already correct skip the
 * UPDATE (which also prevents needless trigger cascades on chained models).
 */
export async function recomputeRow(
  client: PoolClient,
  schemaName: string,
  tableName: string,
  fields: any[],
  recordId: string,
): Promise<{ row: any | null; changed: boolean }> {
  const selectSql = format('SELECT * FROM %I.%I WHERE id = %L', schemaName, tableName, recordId);
  const sel = await client.query(selectSql);
  const row = sel.rows[0];
  if (!row) return { row: null, changed: false };

  const { values } = await computeRecordExpressions(client, schemaName, tableName, fields, row);
  if (Object.keys(values).length === 0) return { row, changed: false };

  const changed: Record<string, any> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!(key in row) || row[key] !== value) changed[key] = value;
  }
  if (Object.keys(changed).length === 0) return { row, changed: false };

  const setClauses = Object.entries(changed).map(([key, value]) => format('%I = %L', key, value));
  const updateSql = format(
    'UPDATE %I.%I SET %s, updated_at = NOW() WHERE id = %L RETURNING *',
    schemaName,
    tableName,
    setClauses.join(', '),
    recordId,
  );
  const upd = await client.query(updateSql);
  return { row: upd.rows[0] || row, changed: true };
}
