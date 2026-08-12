/**
 * I18nContext — i18next bootstrap (en/th resources) and locale switching
 * for the whole console.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  availableLocales: { code: string; label: string }[];
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  availableLocales: [],
});

export const useI18nLocale = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<string>(() => i18n.language || 'en');

  const setLocale = useCallback((newLocale: string) => {
    i18n.changeLanguage(newLocale);
    setLocaleState(newLocale);
  }, []);

  useEffect(() => {
    const handler = (lng: string) => setLocaleState(lng);
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, []);

  const availableLocales = [
    { code: 'en', label: 'English' },
    { code: 'th', label: 'ภาษาไทย' },
  ];

  return (
    <I18nContext.Provider value={{ locale, setLocale, availableLocales }}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </I18nContext.Provider>
  );
};
