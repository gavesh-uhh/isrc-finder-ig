interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  dedupe?: boolean;
}

const MAX_CACHE_ENTRIES = 500;
const MAX_IN_FLIGHT = 100;
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let activeLoads = 0;

export function cacheKey(namespace: string, values: readonly unknown[]): string {
  return `${namespace}:${JSON.stringify(values)}`;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.value;
  }

  if (existing) {
    cache.delete(key);
  }

  const shouldDedupe = options.dedupe !== false;
  if (shouldDedupe) {
    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }
    if (inFlight.size >= MAX_IN_FLIGHT) {
      throw new Error("Too many upstream requests in progress");
    }
  }

  if (activeLoads >= MAX_IN_FLIGHT) {
    throw new Error("Too many upstream requests in progress");
  }
  activeLoads += 1;

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (cache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }
      return value;
    })
    .finally(() => {
      activeLoads -= 1;
      if (shouldDedupe) {
        inFlight.delete(key);
      }
    });

  if (shouldDedupe) {
    inFlight.set(key, promise);
  }
  return promise;
}
