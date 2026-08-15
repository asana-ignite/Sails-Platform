/**
 * I18nContext — i18next bootstrap (en/th resources) and locale switching
 * for the whole console. `availableLocales` is the shared platform set
 * (packages/shared) so dynamic-content localization uses the same languages.
 * The session locale (user preference → tenant default) is adopted on boot by
 * <LocaleSync /> unless the user manually switched (override persisted).
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';
import { SUPPORTED_LOCALES } from '@sails/shared';
import { useAuth } from './AuthContext';

export const LOCALE_OVERRIDE_KEY = 'sails.locale.override';

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  /** Programmatic locale adoption without persisting a user override. */
  applyLocale: (locale: string) => void;
  availableLocales: { code: string; label: string }[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  applyLocale: () => {},
  availableLocales: [],
});

export const useI18nLocale = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<string>(() => i18n.language || 'en');

  /** Programmatic adoption (no override persisted) — used by LocaleSync. */
  const applyLocale = useCallback((newLocale: string) => {
    i18n.changeLanguage(newLocale);
    setLocaleState(newLocale);
  }, []);

  /** User-initiated switch — persisted so the session locale never overrides it. */
  const setLocale = useCallback((newLocale: string) => {
    localStorage.setItem(LOCALE_OVERRIDE_KEY, newLocale);
    applyLocale(newLocale);
  }, [applyLocale]);

  useEffect(() => {
    const handler = (lng: string) => setLocaleState(lng);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, []);

  const availableLocales = SUPPORTED_LOCALES.map((l) => ({ code: l.code, label: l.nativeLabel }));

  return (
    <I18nContext.Provider value={{ locale, setLocale, applyLocale, availableLocales }}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </I18nContext.Provider>
  );
};

/**
 * Adopts the session locale (user preference → tenant default → en) once the
 * auth session resolves — unless the user manually switched language
 * (persisted override wins). Rendered inside the authenticated tree.
 */
export const LocaleSync: React.FC = () => {
  const { locale, applyLocale } = useContext(I18nContext);
  const { user } = useAuth();
  useEffect(() => {
    const override = localStorage.getItem(LOCALE_OVERRIDE_KEY);
    if (override) return;
    const sessionLocale = (user as any)?.locale;
    if (sessionLocale && sessionLocale !== locale) applyLocale(sessionLocale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, locale]);
  return null;
};
