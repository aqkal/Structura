import { and, desc, eq, inArray } from "drizzle-orm";

import type { StatsData } from "@/components/shell/stats-panel";
import { db, schema } from "@/lib/db";

const DAY_MS = 86_400_000;

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getUserStats(userId: string): Promise<StatsData> {
  const completed = await db
    .select({
      id: schema.sessions.id,
      startedAt: schema.sessions.startedAt,
      endedAt: schema.sessions.endedAt,
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.status, "completed"),
      ),
    )
    .orderBy(desc(schema.sessions.startedAt));

  const activeDays = new Set(
    completed.map((s) => utcDayKey(s.endedAt ?? s.startedAt)),
  );

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

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
    avgConfidenceDelta,
    recentDeltas: deltasNewestFirst.slice(0, 10).reverse(),
    weekActivity,
  };
}
