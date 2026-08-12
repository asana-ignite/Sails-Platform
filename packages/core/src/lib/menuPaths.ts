/**
 * menuPaths — navigation path normalization helpers. Menu hrefs are stored
 * case-insensitively and matched against the browser location the same way.
 */
export function normalizeMenuPath(path?: string | null): string {
  return (path || '').trim().replace(/\/+$/, '').toLowerCase();
}

export function isReservedMenuPathError(err: any): boolean {
  return err?.code === 'P2002';
}
