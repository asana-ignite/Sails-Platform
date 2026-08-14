/**
 * JSONata intellisense support — curated function list + suggestion builder.
 * Suggestions merge JSONata's built-in $functions with workflow variables.
 */
import { STRUCTURED_TYPE_SUBFIELDS, EXPRESSION_FUNCTION_DOCS } from '@sails/shared';

export interface Suggestion {
  label: string;
  detail: string;
  insert: string;
  kind: 'function' | 'variable' | 'keyword' | 'field';
}

/** A workflow variable as seen by the editors (schema included for records). */
export interface SuggestionVariable {
  id: string;
  name: string;
  fieldType: string;
  targetModel?: string;
  columns?: { fieldName: string; label: string; logicalType: string; targetModel?: string }[];
}

/** Model tableName → column schema map, used to resolve multi-level record drills. */
export type RecordSchemaMap = Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;

/** Drill roots for the workflow context (record / oldRecord / requestor). */
export type DrillRoots = Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;

/** Context leaves (record. / oldRecord. / requestor. / request_date). */
export const CONTEXT_DRILL_ROOT = 'request_date';

export const JSONATA_FUNCTIONS: { name: string; signature: string; desc: string }[] = [
  { name: '$sum', signature: '$sum(array)', desc: 'Sum of an array of numbers' },
  { name: '$count', signature: '$count(array)', desc: 'Number of items in an array' },
  { name: '$average', signature: '$average(array)', desc: 'Average of an array of numbers' },
  { name: '$min', signature: '$min(array)', desc: 'Minimum value in an array' },
  { name: '$max', signature: '$max(array)', desc: 'Maximum value in an array' },
  { name: '$uppercase', signature: '$uppercase(string)', desc: 'Uppercase a string' },
  { name: '$lowercase', signature: '$lowercase(string)', desc: 'Lowercase a string' },
  { name: '$trim', signature: '$trim(string)', desc: 'Trim surrounding whitespace' },
  { name: '$length', signature: '$length(string)', desc: 'Length of a string' },
  { name: '$substring', signature: '$substring(s, start, len?)', desc: 'Extract part of a string' },
  { name: '$split', signature: '$split(string, sep)', desc: 'Split string into an array' },
  { name: '$join', signature: '$join(array, sep?)', desc: 'Join array into a string' },
  { name: '$contains', signature: '$contains(s, sub)', desc: 'True if s contains sub' },
  { name: '$match', signature: '$match(string, regex)', desc: 'Regex match groups' },
  { name: '$replace', signature: '$replace(s, from, to)', desc: 'Replace text' },
  { name: '$formatNumber', signature: '$formatNumber(n, pattern)', desc: 'Format a number (e.g. #,##0.00)' },
  { name: '$floor', signature: '$floor(n)', desc: 'Round down' },
  { name: '$ceil', signature: '$ceil(n)', desc: 'Round up' },
  { name: '$round', signature: '$round(n, precision?)', desc: 'Round a number' },
  { name: '$abs', signature: '$abs(n)', desc: 'Absolute value' },
  { name: '$not', signature: '$not(x)', desc: 'Logical not' },
  { name: '$and', signature: '$and(array)', desc: 'Logical and of array' },
  { name: '$or', signature: '$or(array)', desc: 'Logical or of array' },
  { name: '$map', signature: '$map(array, fn)', desc: 'Map a function over an array' },
  { name: '$filter', signature: '$filter(array, fn)', desc: 'Filter an array' },
  { name: '$sort', signature: '$sort(array, fn?)', desc: 'Sort an array' },
  { name: '$lookup', signature: '$lookup(object, key)', desc: 'Look up a key in an object' },
  { name: '$string', signature: '$string(value)', desc: 'Convert to string' },
  { name: '$number', signature: '$number(value)', desc: 'Convert to number' },
  { name: '$boolean', signature: '$boolean(value)', desc: 'Convert to boolean' },
  { name: '$exists', signature: '$exists(value)', desc: 'True if value exists' },
  // First-party date/time library (registered server-side + in the Test runner).
  ...EXPRESSION_FUNCTION_DOCS.map((f) => ({
    name: `$${f.name}`,
    signature: f.signature,
    desc: f.description,
  })),
];

/**
 * Build intellisense suggestions.
 *
 * `context` is the source text before the word being typed. When it ends with
 * `<recordVar>.<seg>.` (drill-down), the record's columns are suggested
 * instead; a field carrying a `targetModel` resolves one more level through
 * `recordSchemas`, so `currentRecord.address.country` keeps suggesting.
 */
export function buildJsonataSuggestions(
  variables: SuggestionVariable[],
  query: string,
  context = '',
  recordSchemas?: RecordSchemaMap,
  drillRoots?: DrillRoots,
): Suggestion[] {
  const q = query.toLowerCase();
  const out: Suggestion[] = [];

  // Record drill-down: context like `currentRecord.address.` or `record.`
  const drill = context.match(/([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.$/);
  if (drill) {
    const varName = drill[1];
    const segs = drill[2].split('.').filter(Boolean);
    const v = variables.find((x) => x.name === varName)
      || (drillRoots && drillRoots[varName] ? { name: varName, columns: drillRoots[varName], targetModel: undefined } : undefined);
    // Collection/record variables may declare their columns via targetModel
    // (schemas map) instead of inline — mirror the picker's fallback so
    // `invoice_item.` suggests the item fields.
    let fields = v?.columns?.length
      ? v.columns
      : (v?.targetModel && recordSchemas ? recordSchemas[v.targetModel] : v?.columns);
    let valid = !!fields;
    if (valid) {
      for (const seg of segs) {
        const col = (fields || []).find((f) => f.fieldName === seg || f.label === seg);
        if (!col) { valid = false; break; }
        // Structured JSON types (address / lat_lng) drill into their sub-fields.
        const subs = STRUCTURED_TYPE_SUBFIELDS[col.logicalType];
        if (subs && subs.length > 0) { fields = subs; continue; }
        if (!col.targetModel || !recordSchemas) { valid = false; break; }
        fields = recordSchemas[col.targetModel];
        if (!fields) { valid = false; break; }
      }
    }
    if (valid && fields) {
      for (const f of fields) {
        if (q && !f.fieldName.toLowerCase().includes(q) && !(f.label || '').toLowerCase().includes(q)) continue;
        out.push({
          label: f.label || f.fieldName,
          detail: `field · ${f.logicalType}${f.targetModel ? ` → ${f.targetModel}` : ''}`,
          insert: f.fieldName,
          kind: 'field',
        });
      }
      return out.slice(0, 40);
    }
  }

  for (const v of variables) {
    if (!v.name) continue;
    if (q && !v.name.toLowerCase().includes(q) && !`${v.name}${v.fieldType}`.toLowerCase().includes(q)) continue;
    out.push({
      label: v.name,
      detail: `variable · ${v.fieldType}`,
      insert: v.name,
      kind: 'variable',
    });
  }

  // Drill-root names (record / oldRecord / requestor …) so they are
  // suggestible even when no workflow variables exist.
  if (drillRoots) {
    for (const key of Object.keys(drillRoots)) {
      if (q && !key.toLowerCase().includes(q)) continue;
      const cols = drillRoots[key];
      out.push({
        label: key,
        detail: `context · ${key === 'record' ? 'current record' : key === 'oldRecord' ? 'record before update' : key} (${cols?.length ?? 0} fields)`,
        insert: key,
        kind: 'keyword',
      });
    }
  }

  for (const f of JSONATA_FUNCTIONS) {
    if (q && !f.name.toLowerCase().includes(q) && !f.signature.toLowerCase().includes(q)) continue;
    out.push({
      label: f.name,
      detail: f.signature,
      insert: f.name,
      kind: 'function',
    });
  }

  return out.slice(0, 40);
}
