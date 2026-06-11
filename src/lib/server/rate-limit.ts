/**
 * In-memory sliding-window per-IP rate limiter.
 *
 * Single-process best effort only: each server instance keeps its own
 * counters and they reset on restart. Production should swap this for a
 * shared store such as Upstash Redis (@upstash/ratelimit) so limits hold
 * across instances and deploys.
 */

export type RateBucket = "auth" | "api" | "page";

const WINDOW_MS = 60_000;

/** Allowed requests per key per 60 second window. */
const BUDGETS: Record<RateBucket, number> = {
  auth: 10,
  api: 120,
  page: 300,
};

/** Soft cap on tracked keys; above this we sweep the whole map lazily. */
const MAX_KEYS = 5000;

const hits = new Map<string, number[]>();

export function bucketForPath(pathname: string): RateBucket {
  if (pathname.startsWith("/auth") || pathname.startsWith("/api/auth")) {
    return "auth";
  }
  if (pathname.startsWith("/api")) {
    return "api";
  }
  return "page";
}

function pruneAll(now: number): void {
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, fresh);
    }
  }
}

export function checkRateLimit(
  key: string,
  bucket: RateBucket,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Lazy global prune to bound memory. Deliberately no setInterval: a live
  // timer would keep the process alive and may never fire in serverless.
  if (hits.size > MAX_KEYS) {
    pruneAll(now);
  }

  const fresh = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const budget = BUDGETS[bucket];

  if (fresh.length >= budget) {
    hits.set(key, fresh);
    const oldest = fresh[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  fresh.push(now);
  hits.set(key, fresh);
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Per-key sliding-window limiter with an explicit budget, for limits that
 * are not path/IP based (for example "messages per user per minute"). Same
 * in-memory store and caveats as checkRateLimit; production should move
 * this to a shared store too.
 */
export function checkCustomLimit(
  key: string,
  limit: number,
  windowMs = WINDOW_MS,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (hits.size > MAX_KEYS) {
    pruneAll(now);
  }
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    hits.set(key, fresh);
    const oldest = fresh[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000),
      ),
    };
  }
  fresh.push(now);
  hits.set(key, fresh);
  return { allowed: true, retryAfterSeconds: 0 };
}
