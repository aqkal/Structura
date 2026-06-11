import type { NextRequest } from "next/server";

import { streamHint } from "@/lib/server/ai";
import { resolveModelId } from "@/lib/server/ai/provider";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { countHintsForStep, recordHint } from "@/lib/server/sessions";
import { beginUsage, finishUsage } from "@/lib/server/usage";
import { hintInput, findInjectionMarker } from "@/lib/server/validators";

import {
  aiBudgetHeaders,
  budgetGate,
  completedSteps,
  loadSteps,
  parseBody,
  scaffoldContextFor,
  toHistory,
} from "../shared";

/** Hard cap on hints per step; capped requests never reach the AI. */
const HINTS_PER_STEP = 3;

/**
 * POST /api/session/{id}/hint
 *
 * Streams one small hint for the current step, optionally informed by
 * the student's draft. Disabled in questions_only mode. Capped at
 * HINTS_PER_STEP hints per step. On finish, the hint is stored and
 * session.hintsUsed is incremented atomically.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const body = await parseBody(req, hintInput);
  if (!body.ok) return body.response;
  const { stepNum: targetStep, draft, model: modelId } = body.data;

  if (session.scaffoldMode === "questions_only") {
    return apiError(
      400,
      "hints_disabled",
      "Hints are disabled in questions-only mode.",
    );
  }

  const steps = await loadSteps(session.id);
  const step = steps.find((s) => s.stepNum === targetStep);
  if (!step || step.question.length === 0) {
    return apiError(
      400,
      "no_question",
      "No question exists for this step yet.",
    );
  }

  // Per-step hint cap, checked before the budget gate and the usage
  // reservation so a capped request never consumes AI budget.
  const hintsForStep = await countHintsForStep(step.id);
  if (hintsForStep >= HINTS_PER_STEP) {
    return apiError(429, "hint_limit", "No hints left for this step.");
  }

  // The draft is the student's own text and travels as data, not as an
  // instruction. We still log a marker if present, matching feedback.
  const marker = findInjectionMarker(draft ?? "");
  if (marker) {
    logEvent("injection_marker", {
      route: "hint",
      sessionId: session.id,
      stepNum: targetStep,
      marker,
    });
  }

  const gate = await budgetGate(user.id);
  if (gate.blocked) return gate.blocked;

  // Reserve the usage row before the call so it counts against the budget
  // immediately, not only once streaming finishes.
  const usageId = await beginUsage({
    userId: user.id,
    sessionId: session.id,
    kind: "hint",
    model: resolveModelId(modelId),
  });

  const history = toHistory(completedSteps(steps, targetStep));

  const result = streamHint(
    scaffoldContextFor(session, targetStep, history),
    draft ?? null,
    {
      signal: req.signal,
      modelId,
      onFinish: async (info) => {
        try {
          await recordHint(session.id, step.id, info.text);
          await finishUsage(usageId, info.inputTokens, info.outputTokens);
          logEvent("hint_generated", {
            sessionId: session.id,
            stepNum: targetStep,
            inputTokens: info.inputTokens,
            outputTokens: info.outputTokens,
          });
        } catch (err) {
          logEvent("persist_failed", {
            route: "hint",
            sessionId: session.id,
            stepNum: targetStep,
            errorName: errorName(err),
          });
        }
      },
    },
  );

  return result.toTextStreamResponse({
    // The +1 counts the call just reserved by beginUsage above.
    headers: aiBudgetHeaders(gate.used + 1, gate.budget),
  });
}
