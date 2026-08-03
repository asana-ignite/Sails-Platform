/**
 * SAILS Number Formatting — single source of truth for numeric display.
 * Used by:
 *   - Console (DecimalControl, CurrencyControl, PercentControl, list views)
 *
 * Decimal precision (decimalPlaces) comes from the field's metadata config,
 * falling back to the field-type default when the config omits it.
 */

/** Default decimal places per logical type (matches fieldTypes registry defaults). */
export const DEFAULT_DECIMAL_PLACES: Record<string, number> = {
  decimal: 4,
  currency: 2,
  percentage: 2,
  percent: 2,
};

const MAX_DECIMAL_PLACES = 10;

/**
 * Whether thousands separators (commas) should be shown for a numeric field.
 * Controlled by the `useThousandSeparator` config parameter. Default: ON.
 */
export function resolveThousandSeparator(
  config: Record<string, any> | null | undefined,
  _logicalType?: string
): boolean {
  const raw = config?.useThousandSeparator;
  if (raw === undefined || raw === null) return true;
  return Boolean(raw);
}

/**
 * Resolve the effective number of decimal places for a field.
 * Clamped to a safe 0–10 range.
 */
export function resolveDecimalPlaces(
  config: Record<string, any> | null | undefined,
  logicalType?: string
): number {
  const raw = config?.decimalPlaces;
  const fallback = DEFAULT_DECIMAL_PLACES[logicalType ?? ''] ?? 0;
  const dp = Number(raw);
  if (raw === undefined || raw === null || Number.isNaN(dp)) return fallback;
  return Math.max(0, Math.min(MAX_DECIMAL_PLACES, Math.floor(dp)));
}

/**
 * Clamp a numeric input string so the fractional part never exceeds
 * `maxDecimalPlaces`. Used by numeric controls at typing time (UX guard);
 * server-side validation still runs independently for bypassed paths.
 */
export function clampDecimalInput(value: string, maxDecimalPlaces: number): string {
  if (!value || maxDecimalPlaces <= 0) return value;
  const dotIdx = value.indexOf('.');
  if (dotIdx === -1) return value;
  const fractional = value.slice(dotIdx + 1);
  if (fractional.length <= maxDecimalPlaces) return value;
  return value.slice(0, dotIdx + 1 + maxDecimalPlaces);
}

/**
 * Insert thousands separators into the integer part of a raw numeric string.
 * The fractional part is left untouched. Examples:
 *   "1250"   → "1,250"
 *   "1250.5" → "1,250.5"
 *   "-1250"  → "-1,250"
 */
export function addThousandSeparators(raw: string): string {
  if (!raw) return raw;
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, fracPart] = unsigned.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fracPart !== undefined ? `.${fracPart}` : ''}`;
}

/**
 * Format a raw value (number or string — comma-free) for display inside an
 * edit input. Honors the `useThousandSeparator` toggle; preserves the
 * fractional part as typed (no padding) so typing stays fluid.
 * Use `normalizeEditableValue` on blur for exact decimal-places formatting.
 */
export function formatEditableValue(
  value: any,
  config?: Record<string, any> | null,
  logicalType?: string
): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (!resolveThousandSeparator(config, logicalType)) return s;
  return addThousandSeparators(s);
}

/**
 * Normalize a raw value to exactly the configured number of decimal places,
 * WITHOUT separators (the raw form stored/sent to the API). Non-numeric input
 * is returned unchanged. Examples (decimalPlaces=2): "42.5" → "42.50",
 * "42.501" → "42.50".
 */
export function normalizeEditableValue(
  value: any,
  config?: Record<string, any> | null,
  logicalType?: string
): string {
  const s = String(value ?? '');
  if (s === '' || s === '-') return '';
  const num = Number(s);
  if (Number.isNaN(num)) return s;
  const dp = resolveDecimalPlaces(config, logicalType);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
    useGrouping: false,
  });
}

/**
 * Format a numeric value for display, honoring the configured decimal places
 * and the `useThousandSeparator` toggle.
 * - Empty value        → '—'
 * - Non-numeric value  → raw string (unchanged)
 * - Otherwise          → locale-formatted with exactly `decimalPlaces` digits
 *                        (e.g. decimalPlaces=2 → "1,250.50"; toggle off → "1250.50")
 */
export function formatDecimalValue(
  value: any,
  config?: Record<string, any> | null,
  logicalType?: string
): string {
  if (value === undefined || value === null || value === '') return '\u2014';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  const dp = resolveDecimalPlaces(config, logicalType);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
    useGrouping: resolveThousandSeparator(config, logicalType),
  });
}
