import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { hexToRgbChannels, hexToHSL, hslToHex, computeBackgroundTint, computeMatchingPalette, ColorMatchingTechnique } from '../utils/colorUtils';

interface ThemeState {
  themeMode: 'light' | 'dark';
  primaryAccentColor: string;
  secondaryAccentColor: string | null;
  backgroundAccentColor: string | null;
  fontAccentColor: string | null;
  paletteTechnique?: ColorMatchingTechnique;
  enableGradient?: boolean;
  logoLightUrl: string;
  logoDarkUrl: string;
}

interface ThemeContextType {
  themeMode: 'light' | 'dark';
  primaryAccentColor: string;
  secondaryAccentColor: string | null;
  backgroundAccentColor: string | null;
  fontAccentColor: string | null;
  paletteTechnique?: ColorMatchingTechnique;
  enableGradient?: boolean;
  logoLightUrl: string;
  logoDarkUrl: string;
  setThemeMode: (mode: 'light' | 'dark') => void;
  setPrimaryAccentColor: (color: string) => void;
  setSecondaryAccentColor: (color: string | null) => void;
  setBackgroundAccentColor: (color: string | null) => void;
  setFontAccentColor: (color: string | null) => void;
  setEnableGradient: (enabled: boolean) => void;
  setLogoLightUrl: (url: string) => void;
  setLogoDarkUrl: (url: string) => void;
  commitTheme: (overrides?: Partial<ThemeState>) => void;
  saveBrandingToServer: (overrides?: Record<string, any>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'sails-theme';

function generatePalette(state: ThemeState): Record<string, string> {
  const hexAccent = state.primaryAccentColor;
  const isDark = state.themeMode === 'dark';
  const { r, g, b } = hexToRgbChannels(hexAccent);
  const hsl = hexToHSL(hexAccent);
  const h = hsl.h;

  const matching = computeMatchingPalette(hexAccent, state.paletteTechnique || 'monochromatic', isDark);

  const secondary = state.secondaryAccentColor || matching.secondary;
  const backgroundBody = state.backgroundAccentColor || matching.background;
  const textMain = state.fontAccentColor || matching.font;

  const enableGrad = state.enableGradient !== false; // default true

  // Shift hue 30°, bump saturation +12%, lighten/darken ±15% for visible gradient
  const subtleShiftHex = hslToHex(
    (h + 30) % 360,
    Math.min(100, hsl.s + 12),
    Math.max(10, hsl.l > 50 ? hsl.l - 15 : hsl.l + 15)
  );

  const primaryBg = enableGrad
    ? `linear-gradient(135deg, ${hexAccent} 0%, ${subtleShiftHex} 100%)`
    : hexAccent;

  const bgGrad = enableGrad
    ? (isDark
        ? `linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, ${backgroundBody} 100%)`
        : `linear-gradient(180deg, #ffffff 0%, ${backgroundBody} 100%)`)
    : 'none';

  return {
    '--sails-primary': hexAccent,
    '--sails-primary-bg': primaryBg,
    '--sails-primary-r': String(r),
    '--sails-primary-g': String(g),
    '--sails-primary-b': String(b),

    '--sails-secondary': secondary,

    '--sails-primary-light': isDark
      ? hslToHex(h, 20, 18)
      : hslToHex(h, 25, 93),

    '--sails-primary-dark': isDark
      ? hslToHex(h, 40, 68)
      : hslToHex(h, 45, 38),

    '--sails-bg-body': backgroundBody,
    '--sails-bg-gradient': bgGrad,

    '--sails-bg-sidebar': isDark
      ? hslToHex(h, 3, 14)
      : '#ffffff',

    '--sails-bg-topbar': isDark
      ? hslToHex(h, 3, 16)
      : '#ffffff',

    '--sails-bg-card': isDark
      ? hslToHex(h, 3, 16)
      : '#ffffff',

    '--sails-text-main': textMain,

    '--sails-text-muted': isDark
      ? hslToHex(h, 4, 65)
      : hslToHex(h, 6, 50),

    '--sails-text-light': '#ffffff',

    '--sails-text-sidebar': isDark
      ? hslToHex(h, 4, 65)
      : hslToHex(h, 8, 42),

    '--sails-text-sidebar-active': hexAccent,

    '--sails-border-color': isDark
      ? hslToHex(h, 4, 17)
      : hslToHex(h, 5, 93),

    '--sails-shadow-sm': isDark
      ? '0 2px 4px rgba(0, 0, 0, 0.3)'
      : '0 2px 4px rgba(0, 0, 0, 0.03)',

    '--sails-shadow-md': isDark
      ? '0 4px 12px rgba(0, 0, 0, 0.4)'
      : '0 4px 12px rgba(0, 0, 0, 0.05)',
  };
}

function applyPaletteToDOM(palette: Record<string, string>, mode: 'light' | 'dark') {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

const DEFAULT_THEME: ThemeState = {
  themeMode: 'light',
  primaryAccentColor: '#a855f7',
  secondaryAccentColor: null,
  backgroundAccentColor: null,
  fontAccentColor: null,
  enableGradient: true,
  logoLightUrl: '/assets/logo-standard.jpg',
  logoDarkUrl: '/assets/logo-standard.jpg',
};

function loadFromStorage(): ThemeState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        themeMode: parsed.themeMode === 'dark' ? 'dark' : 'light',
        primaryAccentColor:
          typeof parsed.primaryAccentColor === 'string' && parsed.primaryAccentColor.startsWith('#')
            ? parsed.primaryAccentColor
            : DEFAULT_THEME.primaryAccentColor,
        secondaryAccentColor:
          typeof parsed.secondaryAccentColor === 'string' && parsed.secondaryAccentColor.startsWith('#')
            ? parsed.secondaryAccentColor
            : null,
        backgroundAccentColor:
          typeof parsed.backgroundAccentColor === 'string' && parsed.backgroundAccentColor.startsWith('#')
            ? parsed.backgroundAccentColor
            : null,
        fontAccentColor:
          typeof parsed.fontAccentColor === 'string' && parsed.fontAccentColor.startsWith('#')
            ? parsed.fontAccentColor
            : null,
        enableGradient: typeof parsed.enableGradient === 'boolean' ? parsed.enableGradient : true,
        logoLightUrl:
          typeof parsed.logoLightUrl === 'string' ? parsed.logoLightUrl : DEFAULT_THEME.logoLightUrl,
        logoDarkUrl:
          typeof parsed.logoDarkUrl === 'string' ? parsed.logoDarkUrl : DEFAULT_THEME.logoDarkUrl,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_THEME };
}

function saveToStorage(state: ThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ThemeState>(loadFromStorage);

  const commitTheme = useCallback((overrides?: Partial<ThemeState>) => {
    setState((prev) => {
      const merged = { ...prev, ...overrides };
      const palette = generatePalette(merged);
      applyPaletteToDOM(palette, merged.themeMode);
      saveToStorage(merged);
      return merged;
    });
  }, []);

  // Apply on initial mount only
  useEffect(() => {
    const palette = generatePalette(state);
    applyPaletteToDOM(palette, state.themeMode);
  }, []);

  // Server fetch merges branding/themeConfig then re-applies
  useEffect(() => {
    let cancelled = false;
    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/console/company-profile');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const serverConfig = json.data?.themeConfig;
        if (!json.success || !serverConfig || cancelled) return;
        const serverBranding = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
        setState((prev) => {
          const next: ThemeState = { ...prev };
          if (serverBranding.primaryAccentColor?.startsWith('#'))
            next.primaryAccentColor = serverBranding.primaryAccentColor;
          if (typeof serverBranding.secondaryAccentColor === 'string')
            next.secondaryAccentColor = serverBranding.secondaryAccentColor.startsWith('#') ? serverBranding.secondaryAccentColor : null;
          if (typeof serverBranding.backgroundAccentColor === 'string')
            next.backgroundAccentColor = serverBranding.backgroundAccentColor.startsWith('#') ? serverBranding.backgroundAccentColor : null;
          if (typeof serverBranding.fontAccentColor === 'string')
            next.fontAccentColor = serverBranding.fontAccentColor.startsWith('#') ? serverBranding.fontAccentColor : null;
          if (typeof serverBranding.paletteTechnique === 'string')
            next.paletteTechnique = serverBranding.paletteTechnique as ColorMatchingTechnique;
          if (typeof serverBranding.enableGradient === 'boolean')
            next.enableGradient = serverBranding.enableGradient;
          if (serverBranding.logoLightUrl) next.logoLightUrl = serverBranding.logoLightUrl;
          if (serverBranding.logoDarkUrl) next.logoDarkUrl = serverBranding.logoDarkUrl;
          // Apply merged branding immediately
          const palette = generatePalette(next);
          // Defer DOM update out of render phase
          setTimeout(() => applyPaletteToDOM(palette, next.themeMode), 0);
          saveToStorage(next);
          return next;
        });
      } catch {
        // Server unavailable
      }
    };
    fetchBranding();
    return () => { cancelled = true; };
  }, []);

  const saveBrandingToServerFn = useCallback(async (overrides?: Record<string, any>) => {
    const merged = { ...state, ...overrides };
    await fetch('/api/console/company-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branding: {
          primaryAccentColor: merged.primaryAccentColor,
          secondaryAccentColor: merged.secondaryAccentColor,
          backgroundAccentColor: merged.backgroundAccentColor,
          fontAccentColor: merged.fontAccentColor,
          logoLightUrl: merged.logoLightUrl,
          logoDarkUrl: merged.logoDarkUrl,
        },
      }),
    });
  }, [state]);

  const setThemeMode = useCallback((mode: 'light' | 'dark') => {
    setState((prev) => { const next = { ...prev, themeMode: mode }; saveToStorage(next); return next; });
  }, []);

  const setPrimaryAccentColor = useCallback((color: string) => {
    const normalized = color.startsWith('#') ? color : `#${color}`;
    setState((prev) => { const next = { ...prev, primaryAccentColor: normalized }; saveToStorage(next); return next; });
  }, []);

  const setSecondaryAccentColor = useCallback((color: string | null) => {
    setState((prev) => { const next = { ...prev, secondaryAccentColor: color }; saveToStorage(next); return next; });
  }, []);

  const setBackgroundAccentColor = useCallback((color: string | null) => {
    setState((prev) => { const next = { ...prev, backgroundAccentColor: color }; saveToStorage(next); return next; });
  }, []);

  const setFontAccentColor = useCallback((color: string | null) => {
    setState((prev) => { const next = { ...prev, fontAccentColor: color }; saveToStorage(next); return next; });
  }, []);

  const setEnableGradient = useCallback((enabled: boolean) => {
    setState((prev) => { const next = { ...prev, enableGradient: enabled }; saveToStorage(next); return next; });
  }, []);

  const setLogoLightUrl = useCallback((url: string) => {
    setState((prev) => { const next = { ...prev, logoLightUrl: url }; saveToStorage(next); return next; });
  }, []);

  const setLogoDarkUrl = useCallback((url: string) => {
    setState((prev) => { const next = { ...prev, logoDarkUrl: url }; saveToStorage(next); return next; });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeMode: state.themeMode,
        primaryAccentColor: state.primaryAccentColor,
        secondaryAccentColor: state.secondaryAccentColor,
        backgroundAccentColor: state.backgroundAccentColor,
        fontAccentColor: state.fontAccentColor,
        enableGradient: state.enableGradient,
        paletteTechnique: state.paletteTechnique,
        logoLightUrl: state.logoLightUrl,
        logoDarkUrl: state.logoDarkUrl,
        setThemeMode,
        setPrimaryAccentColor,
        setSecondaryAccentColor,
        setBackgroundAccentColor,
        setFontAccentColor,
        setEnableGradient,
        setLogoLightUrl,
        setLogoDarkUrl,
        commitTheme,
        saveBrandingToServer: saveBrandingToServerFn,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
