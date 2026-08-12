/**
 * expressionLive — client-side evaluation of Expression (computed) fields.
 *
 * Used by the record form (DynamicDetailPage) and Layout Studio preview so a
 * formula recalculates IN REAL TIME while the user types — no save required.
 *
 * Semantics are shared with the server (packages/shared/src/expressionEvaluation):
 * the same first-party function library is registered and the same coercion is
 * applied, so the previewed value always matches what the server will store.
 * `$related('child','fk')` rollups fetch child rows live through the RLS-scoped
 * list API (debounced + cached), and a failed lookup yields [] like the server.
 */
import { coerceExpressionResult, expressionResultType, registerExpressionFunctions } from '@sails/shared';

export interface LiveExpressionResult {
  /** fieldName → coerced computed value (null when unavailable). */
  values: Record<string, any>;
  errors: string[];
}

let jsonataLibPromise: Promise<any> | null = null;

function loadJsonata(): Promise<any> {
  if (!jsonataLibPromise) {
    jsonataLibPromise = import('jsonata').then((mod) => mod.default).catch(() => null);
  }
  return jsonataLibPromise;
}

// ── $related live fetcher (RLS-scoped, debounced, cached) ─────

interface RelatedCacheEntry {
  rows: any[];
  fetchedAt: number;
}

const relatedCache = new Map<string, RelatedCacheEntry>();
const relatedInFlight = new Map<string, Promise<any[]>>();
const RELATED_TTL_MS = 3000;

async function fetchRelatedRows(childTable: string, fkField: string, recordId: string): Promise<any[]> {
  const key = `${childTable}:${fkField}:${recordId}`;
  const cached = relatedCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < RELATED_TTL_MS) return cached.rows;

  const inFlight = relatedInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const filters = encodeURIComponent(JSON.stringify({ [fkField]: recordId }));
      const res = await fetch(`/api/dynamic/${encodeURIComponent(childTable)}?filters=${filters}&limit=100`);
      if (!res.ok) return [];
      const data = await res.json();
      const rows: any[] = data.rows || [];
      relatedCache.set(key, { rows, fetchedAt: Date.now() });
      return rows;
    } catch {
      return [];
    } finally {
      relatedInFlight.delete(key);
    }
  })();

  relatedInFlight.set(key, promise);
  return promise;
}

// ── Public evaluator ───────────────────────────────────────────

/**
 * Evaluate every Expression field of a table against a record snapshot.
 * Same-record formulas evaluate synchronously-exact; `$related` fetches are
 * async (debounced via the in-flight/cache layer) — callers render "…" until
 * the promise resolves.
 */
export async function evaluateExpressionFields(
  fields: any[],
  record: Record<string, any>,
): Promise<LiveExpressionResult> {
  const values: Record<string, any> = {};
  const errors: string[] = [];

  const expressionFields = (fields || []).filter(
    (f) => (f.logicalType || '').toLowerCase() === 'expression',
  );
  if (expressionFields.length === 0) return { values, errors };

  const jsonata = await loadJsonata();
  if (!jsonata) return { values, errors };

  // Live $related: resolve children through the list API (RLS-scoped).
  const extraFunctions: Record<string, (...args: any[]) => Promise<any[]>> = {
    related: async (childTable: unknown, fkField: unknown) => {
      if (
        typeof childTable !== 'string' ||
        typeof fkField !== 'string' ||
        !/^[a-z][a-z0-9_]*$/.test(childTable) ||
        !/^[a-z][a-z0-9_]*$/.test(fkField) ||
        !record?.id
      ) {
        return [];
      }
      return fetchRelatedRows(childTable, fkField, String(record.id));
    },
  };

  for (const field of expressionFields) {
    const config = (field.config || {}) as any;
    const expression = typeof config.expression === 'string' ? config.expression.trim() : '';
    if (!expression) {
      values[field.fieldName] = null;
      continue;
    }
    try {
      const fn = jsonata(expression);
      registerExpressionFunctions(fn, extraFunctions);
      const raw = await fn.evaluate(record || {});
      values[field.fieldName] = coerceExpressionResult(raw, expressionResultType(field));
    } catch (e: any) {
      errors.push(`Field '${field.name || field.fieldName}': ${e?.message || String(e)}`);
      values[field.fieldName] = null;
    }
  }

  return { values, errors };
}
