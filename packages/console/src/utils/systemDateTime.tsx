import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSystemField, parseDateTimeValue, formatDateTokens, formatDateTimeValue } from '@sails/shared';
import type { SailsFieldDefinition } from '@sails/shared';
import { fetchCached } from '../api/client';

export interface GeneralDateTimePrefs {
  dateFormat?: string;
  dateFormatCustom?: string;
  timeFormat?: string;
  timeFormatCustom?: string;
  timezone?: string;
}

export const DEFAULT_DATETIME_PREFS: GeneralDateTimePrefs = {
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
};

/**
 * Load the Date/Time preferences configured in Admin → General Settings
 * (stored on the tenant's company profile). Falls back to safe defaults.
 */
export async function fetchGeneralDateTimePrefs(): Promise<GeneralDateTimePrefs> {
  try {
    const json = await fetchCached('/api/console/company-profile', undefined, 30000);
    const profile = json?.data || json || {};
    return {
      dateFormat: profile.dateFormat || 'YYYY-MM-DD',
      dateFormatCustom: profile.dateFormatCustom || undefined,
      timeFormat: profile.timeFormat || '24h',
      timeFormatCustom: profile.timeFormatCustom || undefined,
      timezone: profile.timezone || undefined,
    };
  } catch {
    return { ...DEFAULT_DATETIME_PREFS };
  }
}

/**
 * True when the field is a platform system field backed by a timestamp column
 * (e.g. created_at / updated_at). Owner (user relation) stays untouched.
 */
export function isSystemDateTimeField(field: SailsFieldDefinition): boolean {
  const key = field && (field.fieldName || field.id);
  const isSystem = !!field.isSystem || isSystemField(key);
  if (!isSystem) return false;
  const pt = (field.physicalType || '').toLowerCase();
  const lt = (field.logicalType || '').toLowerCase();
  return (
    pt === 'timestamp' ||
    pt === 'timestamptz' ||
    pt === 'datetime' ||
    lt === 'timestamp' ||
    lt === 'datetime' ||
    lt === 'timestamptz'
  );
}

function resolveDateToken(prefs?: GeneralDateTimePrefs): string {
  const raw = prefs?.dateFormat || 'YYYY-MM-DD';
  return raw === 'custom' ? (prefs?.dateFormatCustom || 'YYYY-MM-DD') : raw;
}

function resolveTimeToken(prefs?: GeneralDateTimePrefs): string {
  const raw = prefs?.timeFormat || '24h';
  if (raw === '12h') return 'hh:mm A';
  if (raw === 'custom') return prefs?.timeFormatCustom || 'HH:mm';
  return 'HH:mm';
}

function parseAsUtcInstant(value: any): Date | null {
  if (typeof value !== 'string') return null;
  const str = value.trim();
  if (!/\d{4}-\d{1,2}-\d{1,2}[T ]/.test(str)) return null;
  const iso = str.indexOf('Z') !== -1 || /[+-]\d{2}:\d{2}$/.test(str) || /[+-]\d{4}$/.test(str)
    ? str
    : str.replace(' ', 'T');
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Renders the tz wall-clock of `date` via the target timezone using the
 * given moment-style token format. Falls back to local rendering on error.
 */
function formatInTimezone(date: Date, format: string, timeZone: string): string {
  try {
    const parts: Record<string, string> = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .forEach((p) => {
        if (p.type !== 'literal') parts[p.type] = p.value;
      });
    const wall = new Date(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return formatDateTokens(wall, format);
  } catch {
    return formatDateTokens(date, format);
  }
}

/**
 * Format a system-generated datetime value (created_at / updated_at) as
 * "date time" following the Admin General Settings date + time formats and
 * timezone. Returns '—' for empty values.
 */
export function formatSystemDateTimeValue(value: any, prefs?: GeneralDateTimePrefs): string {
  if (value === undefined || value === null || value === '') return '—';

  let date: Date | null = typeof value === 'string' ? parseAsUtcInstant(value) : null;
  if (!date) date = parseDateTimeValue(value);
  if (!date) return '—';

  const tokenFormat = `${resolveDateToken(prefs)} ${resolveTimeToken(prefs)}`;

  if (prefs?.timezone) return formatInTimezone(date, tokenFormat, prefs.timezone);

  return formatDateTokens(date, tokenFormat);
}

/**
 * Display text for date/time controls: system datetime fields (created_at /
 * updated_at) always render with the Admin General Settings date+time format,
 * everything else follows the field's own config.
 */
export function resolveControlDisplayText(
  field: SailsFieldDefinition | undefined,
  value: any,
  prefs?: GeneralDateTimePrefs,
  fallbackLogicalType?: string
): string {
  if (!value) return '';
  if (field && isSystemDateTimeField(field)) {
    return formatSystemDateTimeValue(value, prefs);
  }
  return formatDateTimeValue(value, field?.config, field?.logicalType || fallbackLogicalType || '');
}

// ── Global provider: makes the Admin General Settings date/time prefs
//    available to control plugins (read-only system fields) and pages. ──

const DateTimePrefsContext = createContext<GeneralDateTimePrefs>(DEFAULT_DATETIME_PREFS);

export const useDateTimePrefs = (): GeneralDateTimePrefs => useContext(DateTimePrefsContext);

export const DateTimePrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<GeneralDateTimePrefs>(DEFAULT_DATETIME_PREFS);

  useEffect(() => {
    let active = true;
    fetchGeneralDateTimePrefs()
      .then((p) => {
        if (active) setPrefs(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return <DateTimePrefsContext.Provider value={prefs}>{children}</DateTimePrefsContext.Provider>;
};