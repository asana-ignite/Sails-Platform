/**
 * expressionEvaluation — shared evaluation semantics for Expression fields.
 *
 * The coercion rules below are the single source of truth for BOTH sides:
 *   - sails-core stores the computed value after coerceExpressionResult, and
 *   - sails-console's live form preview applies the identical coercion so the
 *     value shown while typing always matches what the server will store.
 *
 * Semantics: invalid/missing results become NULL (never an exception), and
 * result types map to the physical column types in the core plugin.
 */

export type ExpressionResultType = 'number' | 'text' | 'boolean' | 'date';

/** Resolve a field's configured result type (defaults to text). */
export function expressionResultType(field: any): ExpressionResultType {
  const rt = (field?.config as any)?.resultType;
  return rt === 'number' || rt === 'boolean' || rt === 'date' ? rt : 'text';
}

/** Coerce a JSONata result to the stored representation of the result type. */
export function coerceExpressionResult(value: any, resultType: ExpressionResultType): any {
  if (value === undefined || value === null) return null;
  switch (resultType) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'boolean': {
      if (value === true || value === 'true' || value === '1' || value === 1) return true;
      if (value === false || value === 'false' || value === '0' || value === 0) return false;
      return null;
    }
    case 'date': {
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'text':
    default:
      return String(value);
  }
}
