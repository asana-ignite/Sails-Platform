/**
 * useLocalizedText — resolves user-built (dynamic) content for the active
 * locale: user locale → tenant default locale → 'en' → plain string.
 *
 * Usage: `const L = useLocalizedText(); ... <span>{L(section.title)}</span>`
 */
import { useCallback } from 'react';
import { localize, type LocalizedText } from '@sails/shared';
import { useI18nLocale } from '../contexts/I18nContext';
import { useConsole } from '../contexts/ConsoleContext';

export function useLocalizedText(): (value: LocalizedText | null | undefined) => string {
  const { locale } = useI18nLocale();
  const { defaultLocale } = useConsole();
  return useCallback(
    (value: LocalizedText | null | undefined) => localize(value, locale, defaultLocale),
    [locale, defaultLocale],
  );
}

export type { LocalizedText };
