import i18n from './i18n';

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
