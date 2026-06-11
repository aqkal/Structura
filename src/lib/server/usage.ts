import { and, count, eq, gte } from "drizzle-orm";

import { db, schema } from "@/lib/db";

type UsageKind = "scaffold" | "feedback" | "hint" | "judge" | "chat";

/**
 * Reserve a usage event BEFORE the AI call starts.
 *
 * The row is inserted immediately (with zero tokens) so it counts toward
 * the daily budget the instant the call begins, not when it finishes. This
 * closes the race where many concurrent requests all read a stale "used"
 * count, pass the gate, and blow past the budget: each one inserts its row
 * up front, so later requests in the same burst see them.
 *
 * Returns the row id so `finishUsage` can fill in real token counts.
 */
export async function beginUsage(args: {
  userId: string;
  sessionId?: string | null;
  kind: UsageKind;
  model: string;
}): Promise<string> {
  const [row] = await db
    .insert(schema.usageEvents)
    .values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      kind: args.kind,
      model: args.model,
      tokensIn: 0,
      tokensOut: 0,
    })
    .returning({ id: schema.usageEvents.id });
  return row.id;
}

/** Fill in token counts on a previously reserved usage row. */
export async function finishUsage(
  usageId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await db
    .update(schema.usageEvents)
    .set({ tokensIn: inputTokens, tokensOut: outputTokens })
    .where(eq(schema.usageEvents.id, usageId));
}

/**
 * Per-user daily AI call budget. "Daily" means the current UTC day, so the
 * counter resets at 00:00 UTC for everyone. Counts reserved rows too, so a
 * burst of concurrent requests is bounded by the budget rather than all
 * slipping through on a stale read.
 */
export async function checkDailyBudget(
  userId: string,
): Promise<{ allowed: boolean; used: number; budget: number }> {
  const budget = Number(process.env.AI_DAILY_CALL_BUDGET ?? 80);

  const now = new Date();
  const utcDayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [row] = await db
    .select({ used: count() })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.userId, userId),
        gte(schema.usageEvents.createdAt, utcDayStart),
      ),
    );

  const used = row?.used ?? 0;
  return { allowed: used < budget, used, budget };
}
