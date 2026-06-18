import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export type RateBucket = "auth" | "api" | "page";

const WINDOW_MS = 60_000;

const BUDGETS: Record<RateBucket, number> = {
  auth: 10,
  api: 120,
  page: 300,
};

export function bucketForPath(pathname: string): RateBucket {
  if (pathname.startsWith("/auth") || pathname.startsWith("/api/auth")) {
    return "auth";
  }
  if (pathname.startsWith("/api")) {
    return "api";
  }
  return "page";
}

type Verdict = { allowed: boolean; retryAfterSeconds: number };

async function hit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<Verdict> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  try {
    const rows = (await db.execute(sql`
      insert into rate_limits (key, window_start, count)
      values (${key}, ${windowStart}, 1)
      on conflict (key) do update set
        count = case
          when rate_limits.window_start = ${windowStart}
          then rate_limits.count + 1
          else 1
        end,
        window_start = ${windowStart}
      returning count
    `)) as unknown as Array<{ count: number }>;

    const count = Number(rows[0]?.count ?? 1);
    if (count > limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowStart.getTime() + windowMs - now) / 1000),
      );
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function checkRateLimit(
  key: string,
  bucket: RateBucket,
): Promise<Verdict> {
  return hit(key, BUDGETS[bucket], WINDOW_MS);
}

export function checkCustomLimit(
  key: string,
  limit: number,
  windowMs = WINDOW_MS,
): Promise<Verdict> {
  return hit(key, limit, windowMs);
}

export async function pruneRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = (await db.execute(sql`
    delete from rate_limits where window_start < ${cutoff} returning key
  `)) as unknown as Array<{ key: string }>;
  return rows.length;
}
