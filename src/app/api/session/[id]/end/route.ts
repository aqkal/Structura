import type { NextRequest } from "next/server";
import { z } from "zod";

import { isIntentionKey } from "@/lib/guided";
import { generateSummary } from "@/lib/server/ai/guided";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { finalizeGuidedSession } from "@/lib/server/sessions";
import { beginUsage, deleteUsage, finishUsage } from "@/lib/server/usage";
import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";

import { aiBudgetHeaders, budgetGate, parseBody } from "../shared";

export const maxDuration = 60;

const endInput = z.object({
  pasted: z.boolean().optional(),
  model: z.string().max(64).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  if (session.status === "completed" && session.summary) {
    return Response.json({
      summary: session.summary,
      elapsedSeconds: session.elapsedSeconds,
    });
  }
  if (!isIntentionKey(session.intention)) {
    return apiError(400, "bad_intention", "This session has no intention.");
  }

  const body = await parseBody(req, endInput);
  if (!body.ok) return body.response;

  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.sessionId, session.id))
    .orderBy(asc(schema.steps.stepNum));

  const answered = steps.filter(
    (s) => (s.userResponse ?? "").trim().length > 0,
  );
  if (answered.length === 0) {
    return apiError(400, "nothing_to_summarize", "Answer a move first.");
  }

  const gate = await budgetGate(user.id);
  if (gate.blocked) return gate.blocked;

  const usageId = await beginUsage({
    userId: user.id,
    sessionId: session.id,
    kind: "judge",
    model: "",
  });

  try {
    const result = await generateSummary({
      topic: session.problemText,
      intention: session.intention,
      modelId: body.data.model,
      turns: steps.map((s) => ({
        question: s.question,
        answer: s.userResponse,
      })),
      pasted: Boolean(body.data.pasted),
    });
    await finishUsage(usageId, result.inputTokens, result.outputTokens);

    const { elapsedSeconds, summary } = await finalizeGuidedSession(session, {
      summary: result.summary,
      pasted: Boolean(body.data.pasted),
    });
    logEvent("guided_completed", {
      sessionId: session.id,
      moves: answered.length,
    });

    return new Response(JSON.stringify({ summary, elapsedSeconds }), {
      headers: {
        "content-type": "application/json",
        ...aiBudgetHeaders(gate.used + 1, gate.budget),
      },
    });
  } catch (err) {
    await deleteUsage(usageId);
    logEvent("guided_end_failed", {
      sessionId: session.id,
      errorName: errorName(err),
    });
    return apiError(502, "ai_failed", "Could not summarise the session.");
  }
}
