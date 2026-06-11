import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";

export type SessionRow = typeof schema.sessions.$inferSelect;
export type StepRow = typeof schema.steps.$inferSelect;

/**
 * Every externally supplied sessionId is validated before it reaches a
 * query. A malformed uuid must read as "not found", never as a Postgres
 * cast error bubbling up to the route.
 */
const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * Mirror the Supabase auth user into our users table. Safe to call on
 * every request; conflicts on the primary key are ignored.
 */
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

export async function createSession(
  userId: string,
  input: {
    problemText: string;
    subjectSlug: string;
    scaffoldMode: "guided" | "questions_only" | "with_examples";
  },
): Promise<string> {
  const [row] = await db
    .insert(schema.sessions)
    .values({
      userId,
      problemText: input.problemText,
      subjectSlug: input.subjectSlug,
      scaffoldMode: input.scaffoldMode,
    })
    .returning({ id: schema.sessions.id });
  return row.id;
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

export type SessionState = {
  session: SessionRow;
  steps: StepRow[];
  hintsByStep: Record<number, string[]>;
  confidence: Partial<Record<"start" | "mid" | "end", number>>;
};

/**
 * Full state for the session screen: the session row, its steps in
 * order, hints grouped by step number, and confidence ratings keyed
 * by measurement point.
 */
export async function getSessionState(
  sessionId: string,
  userId: string,
): Promise<SessionState | null> {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) return null;

  const stepRows = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.sessionId, session.id))
    .orderBy(asc(schema.steps.stepNum));

  const hintsByStep: Record<number, string[]> = {};
  if (stepRows.length > 0) {
    const hintRows = await db
      .select({
        stepNum: schema.steps.stepNum,
        text: schema.hints.text,
      })
      .from(schema.hints)
      .innerJoin(schema.steps, eq(schema.hints.stepId, schema.steps.id))
      .where(eq(schema.steps.sessionId, session.id))
      .orderBy(asc(schema.hints.createdAt));
    for (const hint of hintRows) {
      (hintsByStep[hint.stepNum] ??= []).push(hint.text);
    }
  }

  const confidenceRows = await db
    .select({
      point: schema.confidenceRatings.point,
      rating: schema.confidenceRatings.rating,
    })
    .from(schema.confidenceRatings)
    .where(eq(schema.confidenceRatings.sessionId, session.id));

  const confidence: Partial<Record<"start" | "mid" | "end", number>> = {};
  for (const row of confidenceRows) {
    confidence[row.point] = row.rating;
  }

  return { session, steps: stepRows, hintsByStep, confidence };
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

/**
 * Mark a session completed and record elapsed time. Idempotent: calling
 * it again on a completed session returns the stored elapsedSeconds
 * without rewriting endedAt.
 */
export async function markSessionComplete(
  sessionId: string,
  userId: string,
): Promise<{ elapsedSeconds: number } | null> {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) return null;

  if (session.status === "completed") {
    return { elapsedSeconds: session.elapsedSeconds };
  }

  const now = new Date();
  const elapsedSeconds = Math.floor(
    (now.getTime() - session.startedAt.getTime()) / 1000,
  );

  await db
    .update(schema.sessions)
    .set({ status: "completed", endedAt: now, elapsedSeconds })
    .where(
      and(
        eq(schema.sessions.id, session.id),
        eq(schema.sessions.userId, userId),
      ),
    );

  return { elapsedSeconds };
}

export async function listSubjects(): Promise<
  Array<{ slug: string; label: string }>
> {
  return db
    .select({ slug: schema.subjects.slug, label: schema.subjects.label })
    .from(schema.subjects)
    .orderBy(asc(schema.subjects.sortOrder));
}

/**
 * Persist a completed step in one transaction:
 *   1. write the response + feedback + completion time,
 *   2. self-heal by deleting any steps after this one (a no-op in the
 *      normal forward flow; only matters right after a revision reset),
 *   3. advance the session's current step.
 * Atomic so a concurrent reader never sees currentStep pointing past a
 * step that was just deleted.
 */
export async function persistStepCompletion(args: {
  sessionId: string;
  stepId: string;
  stepNum: number;
  userResponse: string;
  aiFeedback: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.steps)
      .set({
        userResponse: args.userResponse,
        aiFeedback: args.aiFeedback,
        completedAt: new Date(),
      })
      .where(eq(schema.steps.id, args.stepId));

    await tx
      .delete(schema.steps)
      .where(
        and(
          eq(schema.steps.sessionId, args.sessionId),
          gt(schema.steps.stepNum, args.stepNum),
        ),
      );

    await tx
      .update(schema.sessions)
      .set({ currentStep: args.stepNum })
      .where(eq(schema.sessions.id, args.sessionId));
  });
}

/**
 * Reset a completed step so the student can redo it ("try again").
 * Transactional and owner-scoped. Deletes later steps, clears the
 * target's feedback + completion, bumps revision and rewrite counters
 * atomically, and rewinds currentStep. Returns false if the session is
 * not owned by the user or the step is not in a completed state.
 */
export async function resetStepForRevision(
  sessionId: string,
  userId: string,
  stepNum: number,
): Promise<boolean> {
  if (!isUuid(sessionId)) return false;

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          eq(schema.sessions.userId, userId),
        ),
      )
      .limit(1);
    if (!session || session.status !== "active") return false;

    const [step] = await tx
      .select()
      .from(schema.steps)
      .where(
        and(
          eq(schema.steps.sessionId, sessionId),
          eq(schema.steps.stepNum, stepNum),
        ),
      )
      .limit(1);
    if (!step || step.completedAt === null) return false;

    await tx
      .delete(schema.steps)
      .where(
        and(
          eq(schema.steps.sessionId, sessionId),
          gt(schema.steps.stepNum, stepNum),
        ),
      );

    await tx
      .update(schema.steps)
      .set({
        completedAt: null,
        aiFeedback: null,
        revisionCount: sql`${schema.steps.revisionCount} + 1`,
      })
      .where(eq(schema.steps.id, step.id));

    await tx
      .update(schema.sessions)
      .set({
        rewrites: sql`${schema.sessions.rewrites} + 1`,
        currentStep: Math.max(stepNum - 1, 0),
      })
      .where(eq(schema.sessions.id, sessionId));

    return true;
  });
}

/**
 * Record a hint and bump the session's hint counter atomically. The
 * increment is done in SQL (`hints_used + 1`) so concurrent hint requests
 * never lose an increment to a stale read-modify-write.
 */
export async function recordHint(
  sessionId: string,
  stepId: string,
  text: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.hints).values({ stepId, text });
    await tx
      .update(schema.sessions)
      .set({ hintsUsed: sql`${schema.sessions.hintsUsed} + 1` })
      .where(eq(schema.sessions.id, sessionId));
  });
}

/**
 * Hints already issued for one step. Step ids are unique per
 * (session, stepNum), so counting by step id is exactly the per-step
 * count the hint cap needs.
 */
export async function countHintsForStep(stepId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.hints)
    .where(eq(schema.hints.stepId, stepId));
  return row?.value ?? 0;
}

/** Calendar day difference between two instants, measured in UTC days. */
function utcDayDiff(from: Date, to: Date): number {
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Record a post-session reflection. The retrospectives table has no
 * unique index on session_id (unlike confidence_ratings), so the schema
 * allows multiple reflections per session and each save appends a row.
 * writtenAfterDays is computed server-side against the session's
 * completion time, falling back to its start: 0 when written on the
 * same UTC day, otherwise the UTC day difference (clamped to smallint).
 */
export async function saveRetrospective(
  session: SessionRow,
  body: string,
): Promise<{ writtenAfterDays: number }> {
  const anchor = session.endedAt ?? session.startedAt;
  const writtenAfterDays = Math.min(
    Math.max(utcDayDiff(anchor, new Date()), 0),
    32767,
  );

  await db.insert(schema.retrospectives).values({
    sessionId: session.id,
    body,
    writtenAfterDays,
  });

  return { writtenAfterDays };
}

/**
 * Delete a session the user owns. A single owner-scoped statement;
 * cascading foreign keys clear the session's steps, hints, confidence
 * ratings, and retrospectives, while usage_events keep their rows with
 * session_id set to null. Returns false for a malformed id or a session
 * that is missing or owned by someone else.
 */
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
