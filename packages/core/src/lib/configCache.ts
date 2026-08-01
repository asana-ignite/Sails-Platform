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
