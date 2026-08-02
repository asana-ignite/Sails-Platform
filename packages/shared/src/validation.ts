/**
 * SAILS Field Validation — single source of truth for client + server.
 * Used by:
 *   - Console (DynamicDetailPage, Layout Studio preview) via DetailFieldInput
 *   - Core API (POST/PATCH /api/dynamic/[tableName]) before write
 *
 * Enforces field-level rules from metadata config:
 *   - isRequired
 *   - min / max  (numeric types: number, decimal, currency, percentage, auto_number)
 *   - maxLength  (text types: short_text, text, email, phone, url, long_text, textarea, rich_text)
 */

export interface ValidationIssue {
  fieldName: string;
  message: string;
}

export interface ValidatableField {
  fieldName?: string;
  logicalType: string;
  isRequired?: boolean;
  /** JSON-compatible metadata config (Prisma JsonValue on the server). */
  config?: any;
}

const NUMERIC_TYPES = new Set([
  'number',
  'decimal',
  'currency',
  'percentage',
  'percent',
  'auto_number',
]);

const TEXT_TYPES = new Set([
  'short_text',
  'text',
  'email',
  'phone',
  'url',
  'long_text',
  'textarea',
  'rich_text',
]);

function toNumber(value: any): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function isEmptyValue(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Validate a single field value against its metadata config. Returns error messages. */
export function validateFieldValue(
  field: ValidatableField,
  value: any
): string[] {
  const issues: string[] = [];
  const config = (field.config || {}) as Record<string, any>;

  if (field.isRequired && isEmptyValue(value)) {
    issues.push('This field is required');
  }

  if (isEmptyValue(value)) return issues;

  if (NUMERIC_TYPES.has(field.logicalType)) {
    const num = toNumber(value);
    if (num !== null) {
      const min = Number(config.min);
      const max = Number(config.max);
      if (config.min !== undefined && config.min !== null && !Number.isNaN(min) && num < min) {
        issues.push(`Must be at least ${config.min}`);
      }
      if (config.max !== undefined && config.max !== null && !Number.isNaN(max) && num > max) {
        issues.push(`Must be at most ${config.max}`);
      }
    }
  }

  if (TEXT_TYPES.has(field.logicalType)) {
    const len = typeof value === 'string' ? value.length : String(value ?? '').length;
    const maxLen = Number(config.maxLength);
    if (config.maxLength !== undefined && config.maxLength !== null && !Number.isNaN(maxLen) && len > maxLen) {
      issues.push(`Max ${config.maxLength} characters`);
    }
  }

  return issues;
}

/** Validate all fields against a record of values. Returns field-scoped issues. */
export function validateRecord(
  fields: ValidatableField[],
  values: Record<string, any>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    if (!field.fieldName) continue;
    for (const message of validateFieldValue(field, values[field.fieldName])) {
      issues.push({ fieldName: field.fieldName, message });
    }
  }
  return issues;
}
