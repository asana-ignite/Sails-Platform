import i18n from './i18n';
import { localize, type LocalizedText } from '@sails/shared';

export function safeT(key?: string | null, fallback?: string): string {
  if (!key) return fallback || '';
  try {
    const result = i18n.t(key);
    if (!result || result === key) {
      return fallback || key;
    }
    return result;
  } catch (e) {
    console.error('[i18n] safeT failed for key:', key, e);
    return fallback || key;
  }
}

/**
 * Resolve a possibly-localized fallback for the current i18next language
 * (used with static `translation_key` labels): static key wins, otherwise the
 * LocalizedText value is resolved for the active locale.
 */
export function localizeFallback(
  staticKey: string | null | undefined,
  value: LocalizedText | null | undefined,
  defaultLocale?: string | null,
): string {
  if (staticKey) {
    const translated = safeT(staticKey, '');
    if (translated && translated !== staticKey) return translated;
  }
  return localize(value, i18n.language, defaultLocale || 'en');
}
