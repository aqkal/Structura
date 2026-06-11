import type { NextRequest } from "next/server";

import { streamScaffold } from "@/lib/server/ai";
import { resolveModelId } from "@/lib/server/ai/provider";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { beginUsage, finishUsage } from "@/lib/server/usage";
import { nextStepInput } from "@/lib/server/validators";
import { db, schema } from "@/lib/db";

import {
  aiBudgetHeaders,
  budgetGate,
  completedSteps,
  currentAiBudgetHeaders,
  loadSteps,
  scaffoldContextFor,
  toHistory,
} from "../shared";

/**
 * POST /api/session/{id}/next-step
 *
 * Streams the scaffold question for the next incomplete step as
 * text/plain, with the step number in the x-step-num header. If the
 * question already exists (page reload), returns it verbatim without
 * calling the AI.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  if (session.status !== "active") {
    return apiError(400, "session_not_active", "This session is not active.");
  }

  // The body is optional ({ model? }); older clients send none at all.
  const raw: unknown = await req.json().catch(() => null);
  const parsedBody = nextStepInput.safeParse(raw ?? {});
  const modelId = parsedBody.success ? parsedBody.data.model : undefined;

  const steps = await loadSteps(session.id);
  const completed = completedSteps(steps);
  const nextNum = completed.length + 1;

  if (nextNum > session.totalSteps) {
    return apiError(
      400,
      "all_steps_complete",
      "All steps are already complete.",
    );
  }

  const existing = steps.find((s) => s.stepNum === nextNum);
  if (existing && existing.question.length > 0) {
    // Cached replay reserves no AI call, so the budget headers are a
    // plain snapshot of today's usage.
    return new Response(existing.question, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-step-num": String(nextNum),
        ...(await currentAiBudgetHeaders(user.id)),
      },
    });
  }

  const gate = await budgetGate(user.id);
  if (gate.blocked) return gate.blocked;

  const usageId = await beginUsage({
    userId: user.id,
    sessionId: session.id,
    kind: "scaffold",
    model: resolveModelId(modelId),
  });

  const result = streamScaffold(
    scaffoldContextFor(session, nextNum, toHistory(completed)),
    {
      signal: req.signal,
      modelId,
      onFinish: async (info) => {
        try {
          await db
            .insert(schema.steps)
            .values({
              sessionId: session.id,
              stepNum: nextNum,
              question: info.text,
            })
            .onConflictDoUpdate({
              target: [schema.steps.sessionId, schema.steps.stepNum],
              set: { question: info.text },
            });
          await finishUsage(usageId, info.inputTokens, info.outputTokens);
          logEvent("scaffold_generated", {
            sessionId: session.id,
            stepNum: nextNum,
            inputTokens: info.inputTokens,
            outputTokens: info.outputTokens,
          });
        } catch (err) {
          logEvent("persist_failed", {
            route: "next-step",
            sessionId: session.id,
            stepNum: nextNum,
            errorName: errorName(err),
          });
        }
      },
    },
  );

  return result.toTextStreamResponse({
    headers: {
      "x-step-num": String(nextNum),
      // The +1 counts the call just reserved by beginUsage above.
      ...aiBudgetHeaders(gate.used + 1, gate.budget),
    },
  });
}
