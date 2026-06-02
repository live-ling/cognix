/**
 * localStorage-based cache with TTL support.
 * Used to cache non-sensitive API responses on the client side.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const CACHE_PREFIX = 'cognix_cache_';

export const CacheManager = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() > entry.expires) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    try {
      const entry: CacheEntry<T> = { data, expires: Date.now() + ttlMs };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  },

  remove(key: string): void {
    localStorage.removeItem(CACHE_PREFIX + key);
  },

  clear(): void {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  },
};
