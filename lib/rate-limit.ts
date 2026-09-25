import type { NextRequest } from "next/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 2_000;
const buckets = new Map<string, RateBucket>();

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) {
      break;
    }
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number,
  namespace = "global",
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${namespace}:${getClientKey(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) {
      pruneBuckets(now);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
