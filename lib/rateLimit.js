const buckets = new Map();

export function checkRateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucketKey = key || "unknown";
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  current.count += 1;
  buckets.set(bucketKey, current);

  if (current.count > limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  return { ok: true, remaining: Math.max(limit - current.count, 0), resetAt: current.resetAt };
}
