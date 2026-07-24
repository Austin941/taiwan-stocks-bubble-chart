// ============================================================
// _lib/cache.js — In-Memory LRU Cache
// 共享快取：所有 API handler 共用同一份記憶體快取
// Vercel Serverless Function 在同一個 instance 中共用記憶體
// ============================================================

class LRUCache {
  constructor(maxSize = 200) {
    this._map   = new Map();
    this._max   = maxSize;
  }

  get(key) {
    if (!this._map.has(key)) return null;
    const entry = this._map.get(key);
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    // LRU: move to end
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._max) {
      // Evict oldest entry
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key) { return this.get(key) !== null; }
  size()   { return this._map.size; }
}

// Singleton shared across all imports in the same Serverless instance
export const cache = new LRUCache(200);

// TTL constants (ms)
export const TTL = {
  MARKET_LIVE:   10_000,    // 10s  — TWSE MIS 即時報價
  CLOSING:       3_600_000, // 1hr  — 收盤價
  CHIP:          300_000,   // 5min — FinMind 三大法人
  MARGIN:        300_000,   // 5min — FinMind 融資券
  T86:           600_000,   // 10min — TWSE T86 三大法人
  KLINE:         300_000,   // 5min — Yahoo K線
};

/**
 * Cache-aside helper: fetch from cache, or run fetcher and store result.
 * @param {string} key  — Cache key
 * @param {function} fetcher — Async function returning data
 * @param {number} ttlMs — TTL in milliseconds
 * @param {boolean} [staleOk=true] — Return stale data if fetcher fails
 */
export async function withCache(key, fetcher, ttlMs, staleOk = true) {
  const cached = cache.get(key);
  if (cached !== null) return cached;

  // Track in-flight requests to prevent stampede
  if (_inflight.has(key)) {
    return _inflight.get(key);
  }

  const promise = fetcher()
    .then(data => {
      cache.set(key, data, ttlMs);
      _inflight.delete(key);
      return data;
    })
    .catch(err => {
      _inflight.delete(key);
      // Return stale data if available (even if expired)
      if (staleOk) {
        const stale = _staleMap.get(key);
        if (stale !== undefined) return stale;
      }
      throw err;
    });

  _inflight.set(key, promise);

  // Keep stale copy for fallback
  promise.then(data => _staleMap.set(key, data)).catch(() => {});

  return promise;
}

// In-flight deduplication (prevents stampede for same key)
const _inflight = new Map();
// Stale fallback map (no TTL, used only on error)
const _staleMap = new Map();
