export function normalizeMenuPath(path?: string | null): string {
  return (path || '').trim().replace(/\/+$/, '').toLowerCase();
}

export function isReservedMenuPathError(err: any): boolean {
  return err?.code === 'P2002';
}
