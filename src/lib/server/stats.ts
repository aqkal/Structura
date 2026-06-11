import { and, desc, eq, inArray } from "drizzle-orm";

import type { StatsData } from "@/components/shell/stats-panel";
import { db, schema } from "@/lib/db";

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" in UTC, the day-bucket key for streaks and activity. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Practice stats for the dashboard right panel, computed from existing
 * tables only (sessions + confidence_ratings, no migrations):
 *
 * - currentStreak: consecutive UTC days, ending today or yesterday, with
 *   at least one completed session.
 * - totals: completed sessions, minutes (from elapsedSeconds), hints used.
 * - avgConfidenceDelta: mean of (end - start) where both ratings exist.
 * - recentDeltas: the last 10 completed sessions' deltas, oldest first,
 *   for the sparkline.
 * - weekActivity: the last 7 UTC days, oldest first (today last).
 */
export async function getUserStats(userId: string): Promise<StatsData> {
  const completed = await db
    .select({
      id: schema.sessions.id,
      startedAt: schema.sessions.startedAt,
      endedAt: schema.sessions.endedAt,
      elapsedSeconds: schema.sessions.elapsedSeconds,
      hintsUsed: schema.sessions.hintsUsed,
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.status, "completed"),
      ),
    )
    .orderBy(desc(schema.sessions.startedAt));

  const totalMinutes = Math.round(
    completed.reduce((sum, s) => sum + s.elapsedSeconds, 0) / 60,
  );
  const hintsUsed = completed.reduce((sum, s) => sum + s.hintsUsed, 0);

  const activeDays = new Set(
    completed.map((s) => utcDayKey(s.endedAt ?? s.startedAt)),
  );

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  // Streak walks backwards from today; a streak that ended yesterday
  // still counts (today is not over yet).
  let currentStreak = 0;
  let cursor = todayUtc;
  if (!activeDays.has(utcDayKey(new Date(cursor)))) cursor -= DAY_MS;
  while (activeDays.has(utcDayKey(new Date(cursor)))) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }

  const weekActivity: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    weekActivity.push(
      activeDays.has(utcDayKey(new Date(todayUtc - i * DAY_MS))),
    );
  }

  // Confidence deltas, collected newest-first to match `completed`.
  const deltasNewestFirst: number[] = [];
  let avgConfidenceDelta: number | null = null;

  if (completed.length > 0) {
    const ratings = await db
      .select({
        sessionId: schema.confidenceRatings.sessionId,
        point: schema.confidenceRatings.point,
        rating: schema.confidenceRatings.rating,
      })
      .from(schema.confidenceRatings)
      .where(
        inArray(
          schema.confidenceRatings.sessionId,
          completed.map((s) => s.id),
        ),
      );

    const bySession = new Map<string, { start?: number; end?: number }>();
    for (const r of ratings) {
      const entry = bySession.get(r.sessionId) ?? {};
      if (r.point === "start") entry.start = r.rating;
      if (r.point === "end") entry.end = r.rating;
      bySession.set(r.sessionId, entry);
    }

    for (const s of completed) {
      const entry = bySession.get(s.id);
      if (entry?.start !== undefined && entry.end !== undefined) {
        deltasNewestFirst.push(entry.end - entry.start);
      }
    }

    if (deltasNewestFirst.length > 0) {
      avgConfidenceDelta =
        deltasNewestFirst.reduce((sum, d) => sum + d, 0) /
        deltasNewestFirst.length;
    }
  }

  return {
    currentStreak,
    completedSessions: completed.length,
    totalMinutes,
    hintsUsed,
    avgConfidenceDelta,
    recentDeltas: deltasNewestFirst.slice(0, 10).reverse(),
    weekActivity,
  };
}
