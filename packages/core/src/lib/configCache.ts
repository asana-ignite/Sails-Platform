/**
 * configCache — tiny TTL cache for expensive tenant metadata lookups
 * (e.g. menu path resolution). Entries expire after 30 seconds; callers
 * invalidate explicitly after schema/menu writes so changes surface fast.
 */
const configCache = new Map<string, { data: any; expiresAt: number }>();

export function invalidateConfigCache(tenantId?: string) {
  if (tenantId) {
    for (const key of configCache.keys()) {
      if (key.startsWith(tenantId + ':')) configCache.delete(key);
    }
  } else {
    configCache.clear();
  }
}

export function getConfigCache(key: string): { data: any; expiresAt: number } | undefined {
  return configCache.get(key);
}

export function setConfigCache(key: string, data: any, ttlMs: number = 30000): void {
  configCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
