type CacheEntry = {
  data: any;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
const DEFAULT_TTL = 5000;

export function clearCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

export function invalidateCache(url: string) {
  cache.delete(url);
}

export async function fetchCached(
  url: string,
  opts?: RequestInit,
  ttlMs: number = DEFAULT_TTL
): Promise<any> {
  const cacheKey = `${opts?.method || 'GET'}:${url}`;

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!;
  }

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, opts);
      const data = await res.json();
      cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
      return data;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

export { cache, inflight };
