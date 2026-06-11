import type { NextRequest } from "next/server";

import { streamFeedback } from "@/lib/server/ai";
import { resolveModelId } from "@/lib/server/ai/provider";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { persistStepCompletion } from "@/lib/server/sessions";
import { beginUsage, finishUsage } from "@/lib/server/usage";
import { feedbackInput, findInjectionMarker } from "@/lib/server/validators";

import {
  aiBudgetHeaders,
  budgetGate,
  completedSteps,
  loadSteps,
  parseBody,
  scaffoldContextFor,
  toHistory,
} from "../shared";

/**
 * POST /api/session/{id}/feedback
 *
 * Streams AI feedback on the student's response to a step. On finish, the
 * step is marked complete with the response and feedback stored, and the
 * session advances. Revision bookkeeping (deleting later steps, counting
 * rewrites) is owned by the reset-step route, so completion here is a
 * single transactional write that also self-heals any stray later steps.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const body = await parseBody(req, feedbackInput);
  if (!body.ok) return body.response;
  const { stepNum: targetStep, response, model: modelId } = body.data;

  if (session.status !== "active") {
    return apiError(400, "session_not_active", "This session is not active.");
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

  const marker = findInjectionMarker(response);
  if (marker) {
    logEvent("injection_marker", {
      route: "feedback",
      sessionId: session.id,
      stepNum: targetStep,
      marker,
    });
  }

  const gate = await budgetGate(user.id);
  if (gate.blocked) return gate.blocked;

  const usageId = await beginUsage({
    userId: user.id,
    sessionId: session.id,
    kind: "feedback",
    model: resolveModelId(modelId),
  });

  const history = toHistory(completedSteps(steps, targetStep));

  const result = streamFeedback(
    scaffoldContextFor(session, targetStep, history),
    response,
    {
      signal: req.signal,
      modelId,
      onFinish: async (info) => {
        try {
          await persistStepCompletion({
            sessionId: session.id,
            stepId: step.id,
            stepNum: targetStep,
            userResponse: response,
            aiFeedback: info.text,
          });
          await finishUsage(usageId, info.inputTokens, info.outputTokens);
          logEvent("feedback_generated", {
            sessionId: session.id,
            stepNum: targetStep,
            inputTokens: info.inputTokens,
            outputTokens: info.outputTokens,
          });
        } catch (err) {
          logEvent("persist_failed", {
            route: "feedback",
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
