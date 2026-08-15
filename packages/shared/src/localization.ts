/**
 * localization — shared model + resolution for user-built (dynamic) content.
 *
 * Platform chrome uses i18next static locale files; this module handles the
 * OTHER half: labels/names/messages that USERS author (table & field names,
 * section titles, action/event labels, message boxes, validation messages…).
 *
 * Shape: a value is either a plain string (legacy, single-language — acts as
 * the default) or an object mapping locale → text:
 *
 *   const title: LocalizedText = { en: 'Approvals', th: 'การอนุมัติ' };
 *
 * Resolution order: requested locale → tenant default locale → 'en' → first
 * available entry → the plain string. Same rules on server and client.
 */

/** A translatable user-authored string. */
export type LocalizedText = string | { [locale: string]: string };

/** Languages the platform ships (static chrome + dynamic content). */
export const SUPPORTED_LOCALES: { code: string; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'th', label: 'Thai', nativeLabel: 'ภาษาไทย' },
];

export const DEFAULT_LOCALE = 'en';

export function isLocalized(value: unknown): value is { [locale: string]: string } {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Resolve a LocalizedText value for the given locale.
 * Fallback chain: requested locale → defaultLocale → 'en' → first entry → ''.
 */
export function localize(
  value: LocalizedText | null | undefined,
  locale?: string | null,
  defaultLocale?: string | null,
): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  const wanted = locale || DEFAULT_LOCALE;
  if (typeof value[wanted] === 'string' && value[wanted].trim() !== '') return value[wanted];

  const fallback = defaultLocale || DEFAULT_LOCALE;
  if (fallback !== wanted && typeof value[fallback] === 'string' && value[fallback].trim() !== '') {
    return value[fallback];
  }
  if (wanted !== DEFAULT_LOCALE && typeof value[DEFAULT_LOCALE] === 'string' && value[DEFAULT_LOCALE].trim() !== '') {
    return value[DEFAULT_LOCALE];
  }
  for (const entry of Object.values(value)) {
    if (typeof entry === 'string' && entry.trim() !== '') return entry;
  }
  return '';
}

/**
 * Merge a per-locale text edit into a LocalizedText value.
 * When the result contains only the default locale, it collapses back to the
 * plain string (keeps legacy single-language values simple).
 */
export function setLocalizedText(
  value: LocalizedText | null | undefined,
  locale: string,
  text: string,
): LocalizedText {
  const base: { [locale: string]: string } = isLocalized(value)
    ? { ...value }
    : value && typeof value === 'string'
      ? { [DEFAULT_LOCALE]: value }
      : {};
  if (text.trim() === '') {
    delete base[locale];
  } else {
    base[locale] = text;
  }
  const keys = Object.keys(base);
  if (keys.length === 0) return '';
  if (keys.length === 1 && keys[0] === DEFAULT_LOCALE) return base[DEFAULT_LOCALE] || '';
  return base;
}

/** Current text of a LocalizedText for one locale (empty when missing). */
export function localizedTextFor(value: LocalizedText | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return locale === DEFAULT_LOCALE ? value : '';
  return typeof value[locale] === 'string' ? value[locale] : '';
}

/** True when a value has any non-default translations beyond the plain string. */
export function hasTranslations(value: LocalizedText | null | undefined): boolean {
  if (!isLocalized(value)) return false;
  const keys = Object.keys(value).filter((k) => k !== DEFAULT_LOCALE);
  return keys.some((k) => typeof value[k] === 'string' && value[k].trim() !== '');
}
