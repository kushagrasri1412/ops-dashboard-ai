const store = globalThis.__rateLimitStore || new Map();
// Preserve across hot reloads in dev.
globalThis.__rateLimitStore = store;

export function checkRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const next = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      resetAt: next.resetAt,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}
