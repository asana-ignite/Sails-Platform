/**
 * Workflow collection variable — JSON Schema generation + validation.
 *
 * A `collection` workflow variable is declared by `itemType` plus (for record
 * collections) a `columns` snapshot. This module derives a standard JSON
 * Schema from that declaration and validates runtime values against it.
 */

export interface CollectionColumn {
  fieldName: string;
  label?: string;
  logicalType?: string;
}

export interface CollectionVarShape {
  itemType?: string; // 'record' | 'any' | scalar logical types
  columns?: CollectionColumn[];
}

/** logicalType → JSON Schema fragment. */
export function logicalTypeToJsonSchema(logicalType?: string | null): Record<string, any> {
  switch (logicalType) {
    case 'number': case 'decimal': case 'currency': case 'percentage': case 'auto_number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'expression':
      // Expression (computed) fields are typed by their configured resultType.
      // Without config the runtime value is typically numeric or string — leave
      // the schema open so validation never rejects a legitimate result.
      return { type: ['number', 'string', 'boolean', 'null'] };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'time':
      return { type: 'string', format: 'time' };
    case 'email':
      return { type: 'string', format: 'email' };
    case 'short_text': case 'long_text': case 'rich_text': case 'phone':
    case 'user': case 'select': case 'relation':
      return { type: 'string' };
    case 'collection':
      return { type: 'array' };
    default:
      return {};
  }
}

/** Derive the JSON Schema of a collection variable's runtime value. */
export function collectionValueSchema(shape: CollectionVarShape): Record<string, any> {
  if (shape.itemType === 'record') {
    const cols = shape.columns || [];
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(cols.map((c) => [c.fieldName, logicalTypeToJsonSchema(c.logicalType)])),
        required: cols.map((c) => c.fieldName),
      },
    };
  }
  if (shape.itemType && shape.itemType !== 'any') {
    return { type: 'array', items: logicalTypeToJsonSchema(shape.itemType) };
  }
  return { type: 'array', items: {} };
}

function typeOf(v: any): string {
  if (v === null || v === undefined) return 'null';
  return Array.isArray(v) ? 'array' : typeof v;
}

function matchesSchema(value: any, schema: Record<string, any> | undefined, path: string, errors: string[]): boolean {
  if (!schema || Object.keys(schema).length === 0) return true;
  const t = typeOf(value);
  if (schema.type && schema.type !== t) {
    // Allow string → number coercion when the string is numeric.
    if (schema.type === 'number' && t === 'string' && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return true;
    }
    errors.push(`${path}: expected ${schema.type}, got ${t}`);
    return false;
  }
  return true;
}

/** Validate a runtime value against a derived collection schema. */
export function validateCollectionValue(value: any, shape: CollectionVarShape): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (shape.itemType !== 'collection' && !shape.itemType) {
    return { ok: true, errors }; // not a collection declaration — nothing to validate
  }
  if (!Array.isArray(value)) {
    errors.push('value: expected array (collection)');
    return { ok: false, errors };
  }
  const schema = collectionValueSchema(shape);
  const items = schema.items || {};
  value.forEach((item: any, i: number) => {
    if (items.type === 'object') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`[${i}]: expected object row`);
        return;
      }
      for (const [key, propSchema] of Object.entries(items.properties || {})) {
        if (item[key] !== undefined && item[key] !== null) {
          matchesSchema(item[key], propSchema as any, `[${i}].${key}`, errors);
        } else if ((items.required || []).includes(key)) {
          errors.push(`[${i}].${key}: missing required column`);
        }
      }
    } else if (items.type) {
      matchesSchema(item, items as any, `[${i}]`, errors);
    }
  });
  return { ok: errors.length === 0, errors };
}

/** Validate a single `record` variable's runtime value against its column schema. */
export function validateRecordValue(
  value: any,
  columns: { fieldName: string; logicalType: string }[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!columns || columns.length === 0) return { ok: true, errors };
  if (value === null || value === undefined) return { ok: true, errors }; // absent record — nothing to check
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push('value: expected object (record)');
    return { ok: false, errors };
  }
  const properties = Object.fromEntries(columns.map((c) => [c.fieldName, logicalTypeToJsonSchema(c.logicalType)]));
  for (const col of columns) {
    const prop = properties[col.fieldName] as Record<string, any> | undefined;
    if (value[col.fieldName] === undefined || value[col.fieldName] === null) {
      errors.push(`${col.fieldName}: missing required column`);
      continue;
    }
    matchesSchema(value[col.fieldName], prop, col.fieldName, errors);
  }
  return { ok: errors.length === 0, errors };
}
