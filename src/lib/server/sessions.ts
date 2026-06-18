import { and, asc, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { INTENTIONS, type IntentionKey, type MoveKind } from "@/lib/guided";
import type { ProofSummary } from "@/lib/server/ai/guided";

export type SessionRow = typeof schema.sessions.$inferSelect;
export type StepRow = typeof schema.steps.$inferSelect;

const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

export async function ensureUserRow(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: user.id,
      email: user.email,
      displayName: user.name,
    })
    .onConflictDoNothing();
}

export async function createGuidedSession(
  userId: string,
  input: { topic: string; intention: IntentionKey },
): Promise<string> {
  const total = INTENTIONS[input.intention].moves.length;
  const [row] = await db
    .insert(schema.sessions)
    .values({
      userId,
      problemText: input.topic,
      subjectSlug: "general",
      scaffoldMode: "guided",
      intention: input.intention,
      totalSteps: total,
    })
    .returning({ id: schema.sessions.id });
  return row.id;
}

export type GuidedState = { session: SessionRow; steps: StepRow[] };

export async function getGuidedState(
  sessionId: string,
  userId: string,
): Promise<GuidedState | null> {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) return null;
  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.sessionId, session.id))
    .orderBy(asc(schema.steps.stepNum));
  return { session, steps };
}

export async function appendMove(args: {
  sessionId: string;
  stepNum: number;
  kind: MoveKind;
  question: string;
}): Promise<void> {
  await db
    .insert(schema.steps)
    .values({
      sessionId: args.sessionId,
      stepNum: args.stepNum,
      kind: args.kind,
      question: args.question,
    })
    .onConflictDoUpdate({
      target: [schema.steps.sessionId, schema.steps.stepNum],
      set: { kind: args.kind, question: args.question },
    });
}

export async function saveMoveAnswer(args: {
  sessionId: string;
  stepNum: number;
  answer: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.steps)
      .set({ userResponse: args.answer, completedAt: new Date() })
      .where(
        and(
          eq(schema.steps.sessionId, args.sessionId),
          eq(schema.steps.stepNum, args.stepNum),
        ),
      );
    await tx
      .update(schema.sessions)
      .set({ currentStep: args.stepNum + 1 })
      .where(eq(schema.sessions.id, args.sessionId));
  });
}

export async function finalizeGuidedSession(
  session: SessionRow,
  args: { summary: ProofSummary; pasted: boolean },
): Promise<{ elapsedSeconds: number; summary: ProofSummary }> {
  const now = new Date();
  const elapsedSeconds = Math.floor(
    (now.getTime() - session.startedAt.getTime()) / 1000,
  );

  const won = await db
    .update(schema.sessions)
    .set({
      status: "completed",
      endedAt: now,
      elapsedSeconds,
      pasted: args.pasted,
      summary: args.summary,
    })
    .where(
      and(
        eq(schema.sessions.id, session.id),
        eq(schema.sessions.status, "active"),
      ),
    )
    .returning({ id: schema.sessions.id });

  if (won.length > 0) {
    return { elapsedSeconds, summary: args.summary };
  }

  const [row] = await db
    .select({
      summary: schema.sessions.summary,
      elapsedSeconds: schema.sessions.elapsedSeconds,
    })
    .from(schema.sessions)
    .where(eq(schema.sessions.id, session.id))
    .limit(1);
  return {
    elapsedSeconds: row?.elapsedSeconds ?? elapsedSeconds,
    summary: (row?.summary as ProofSummary | null) ?? args.summary,
  };
}

export type PortfolioEntry = {
  id: string;
  topic: string;
  intention: string;
  summary: ProofSummary | null;
  answeredCount: number;
  pasted: boolean;
  endedAt: string | null;
};

export async function listPortfolio(userId: string): Promise<PortfolioEntry[]> {
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.status, "completed"),
        isNotNull(schema.sessions.summary),
      ),
    )
    .orderBy(desc(schema.sessions.endedAt))
    .limit(60);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const answeredRows = await db
    .select({
      sessionId: schema.steps.sessionId,
      value: count(),
    })
    .from(schema.steps)
    .where(
      and(
        inArray(schema.steps.sessionId, ids),
        isNotNull(schema.steps.userResponse),
      ),
    )
    .groupBy(schema.steps.sessionId);
  const answeredBy = new Map(answeredRows.map((r) => [r.sessionId, r.value]));

  return rows.map((r) => ({
    id: r.id,
    topic: r.problemText,
    intention: r.intention,
    summary: (r.summary as ProofSummary | null) ?? null,
    answeredCount: answeredBy.get(r.id) ?? 0,
    pasted: r.pasted,
    endedAt: r.endedAt?.toISOString() ?? null,
  }));
}

export async function getSessionForUser(
  sessionId: string,
  userId: string,
): Promise<SessionRow | null> {
  if (!isUuid(sessionId)) return null;
  const [row] = await db
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.id, sessionId),
        eq(schema.sessions.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listUserSessions(
  userId: string,
  limit = 12,
): Promise<SessionRow[]> {
  return db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(desc(schema.sessions.startedAt))
    .limit(limit);
}

export async function deleteSessionForUser(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  if (!isUuid(sessionId)) return false;

  const deleted = await db
    .delete(schema.sessions)
    .where(
      and(
        eq(schema.sessions.id, sessionId),
        eq(schema.sessions.userId, userId),
      ),
    )
    .returning({ id: schema.sessions.id });

  return deleted.length > 0;
}
