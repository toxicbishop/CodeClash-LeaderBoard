/**
 * In-memory sliding window rate limiter.
 * Protects sensitive endpoints (login, API sync) against brute force and abuse.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const namespaces = new Map<string, Map<string, RateLimitRecord>>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  if (!namespaces.has(namespace)) {
    namespaces.set(namespace, new Map());
  }

  const store = namespaces.get(namespace)!;
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = store.get(key) || { timestamps: [] };

  // Evict timestamps outside the window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      success: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  store.set(key, record);

  return {
    success: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}

/** Reset rate limit store (useful for tests) */
export function resetRateLimitStore(): void {
  namespaces.clear();
}
