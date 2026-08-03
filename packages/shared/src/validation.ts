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
 *   - decimalPlaces (decimal, currency, percentage — precision limited to the
 *     configured number of decimal digits; default per type when unset)
 */

import { resolveDecimalPlaces } from './numbers';

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
  physicalType?: string;
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

      // Precision check: value must not exceed the configured decimal places.
      // Applies to decimal/currency/percentage (defaults per type in numbers.ts).
      // Trailing zeros ("42.5000" with decimalPlaces=2) pass — only true
      // precision is judged. Float-safe via the scaled-integer comparison.
      if (field.logicalType === 'decimal' || field.logicalType === 'currency' || field.logicalType === 'percentage' || field.logicalType === 'percent') {
        const dp = resolveDecimalPlaces(config, field.logicalType);
        if (dp >= 0) {
          const scaled = num * 10 ** dp;
          if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
            issues.push(`Maximum ${dp} decimal places allowed`);
          }
        }
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
    }
  }
  return issues;
}

const SANITIZE_NULL_TYPES = new Set([
  'number', 'decimal', 'currency', 'percentage', 'percent',
  'boolean', 'date', 'time', 'datetime', 'timestamp',
]);

const SANITIZE_NULL_PHYSICAL = new Set([
  'date', 'time', 'timestamp', 'timestamptz', 'jsonb', 'boolean',
]);

/** Convert empty-string payload values to null for typed (non-text) columns. */
export function sanitizeWritePayload(
  fields: ValidatableField[],
  payload: Record<string, any>
): Record<string, any> {
  const out = { ...payload };
  for (const field of fields) {
    const key = field.fieldName;
    if (!key || !Object.prototype.hasOwnProperty.call(out, key)) continue;
    const val = out[key];
    if (typeof val !== 'string' || val.trim() !== '') continue;
    const lt = (field.logicalType || '').toLowerCase();
    const pt = (field.physicalType || '').toLowerCase();
    if (SANITIZE_NULL_TYPES.has(lt) || SANITIZE_NULL_PHYSICAL.has(pt)) {
      out[key] = null;
    }
  }
  return out;
}
