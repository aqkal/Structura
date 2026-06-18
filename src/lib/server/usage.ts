import { and, count, eq, gte } from "drizzle-orm";

import { db, schema } from "@/lib/db";

type UsageKind = "scaffold" | "feedback" | "hint" | "judge" | "chat";

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

export async function deleteUsage(usageId: string): Promise<void> {
  await db.delete(schema.usageEvents).where(eq(schema.usageEvents.id, usageId));
}

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
