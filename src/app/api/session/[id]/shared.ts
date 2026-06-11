import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import type { z } from "zod";

import type { ScaffoldContext, StepHistoryItem } from "@/lib/server/ai";
import { apiError } from "@/lib/server/api-error";
import type { SessionRow, StepRow } from "@/lib/server/sessions";
import { checkDailyBudget } from "@/lib/server/usage";
import { db, schema } from "@/lib/db";

/**
 * Shared, non-route helpers for the session API handlers. This file is
 * colocated with the routes but is not itself a route (no HTTP exports).
 */

/** All step rows for a session, ordered by step number. */
export async function loadSteps(sessionId: string): Promise<StepRow[]> {
  return db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.sessionId, sessionId))
    .orderBy(asc(schema.steps.stepNum));
}

/**
 * Completed steps, optionally restricted to steps strictly before a
 * given step number (used to build the AI history for a target step).
 */
export function completedSteps(
  steps: StepRow[],
  beforeStepNum?: number,
): StepRow[] {
  return steps.filter(
    (s) =>
      s.completedAt !== null &&
      (beforeStepNum === undefined || s.stepNum < beforeStepNum),
  );
}

/** Map step rows onto the AI layer's history shape. */
export function toHistory(steps: StepRow[]): StepHistoryItem[] {
  return steps.map((s) => ({
    stepNum: s.stepNum,
    question: s.question,
    response: s.userResponse,
    feedback: s.aiFeedback,
  }));
}

/** Build the ScaffoldContext the AI layer expects for a session step. */
export function scaffoldContextFor(
  session: SessionRow,
  stepNum: number,
  history: StepHistoryItem[],
): ScaffoldContext {
  return {
    problem: session.problemText,
    subject: session.subjectSlug,
    scaffoldMode: session.scaffoldMode,
    stepNum,
    totalSteps: session.totalSteps,
    history,
  };
}

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Parse and validate a JSON request body. Invalid JSON and schema
 * failures both surface as 400 bad_request with the first issue message.
 */
export async function parseBody<T>(
  req: NextRequest,
  validator: z.ZodType<T>,
): Promise<ParsedBody<T>> {
  const raw: unknown = await req.json().catch(() => null);
  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return { ok: false, response: apiError(400, "bad_request", message) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Format the AI budget response headers the session views read to show
 * the remaining-calls meter. `used` should already include the call the
 * route is about to reserve (gate.used + 1 after a successful gate).
 */
export function aiBudgetHeaders(
  used: number,
  budget: number,
): Record<string, string> {
  return {
    "x-ai-used": String(used),
    "x-ai-budget": String(budget),
  };
}

/**
 * Snapshot of the current AI budget as headers, for responses that do
 * not reserve a call themselves (for example the cached next-step path).
 */
export async function currentAiBudgetHeaders(
  userId: string,
): Promise<Record<string, string>> {
  const { used, budget } = await checkDailyBudget(userId);
  return aiBudgetHeaders(used, budget);
}

export type BudgetGateResult = {
  /** The 429 to return when the daily budget is exhausted, else null. */
  blocked: NextResponse | null;
  /** Calls used today, not counting the one this request may reserve. */
  used: number;
  budget: number;
};

/**
 * Daily AI budget gate. When the budget is exhausted, `blocked` holds a
 * 429 budget_exceeded response (with budget headers attached) the route
 * should return as-is. Otherwise `blocked` is null and `used`/`budget`
 * let the route attach budget headers to its streaming response.
 */
export async function budgetGate(userId: string): Promise<BudgetGateResult> {
  const { allowed, used, budget } = await checkDailyBudget(userId);
  if (!allowed) {
    const response = apiError(
      429,
      "budget_exceeded",
      "You have used today's AI budget. It resets at midnight UTC.",
    );
    for (const [name, value] of Object.entries(aiBudgetHeaders(used, budget))) {
      response.headers.set(name, value);
    }
    return { blocked: response, used, budget };
  }
  return { blocked: null, used, budget };
}

/** Empty 204 response for fire-and-forget persistence routes. */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
