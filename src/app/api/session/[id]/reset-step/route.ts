import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { resetStepForRevision } from "@/lib/server/sessions";
import { stepNum as stepNumSchema } from "@/lib/server/validators";
import { z } from "zod";

import { parseBody } from "../shared";

const resetInput = z.object({ stepNum: stepNumSchema });

/**
 * POST /api/session/{id}/reset-step
 *
 * Persists a "try again" on a completed step: deletes later steps, clears
 * the target's feedback and completion, bumps the revision and rewrite
 * counters, and rewinds the session. Without this, a reload after clicking
 * "try again" but before resubmitting would resurrect the old completed
 * state and silently lose the student's in-progress revision.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const body = await parseBody(req, resetInput);
  if (!body.ok) return body.response;
  const { stepNum } = body.data;

  if (session.status !== "active") {
    return apiError(400, "session_not_active", "This session is not active.");
  }

  const ok = await resetStepForRevision(session.id, user.id, stepNum);
  if (!ok) {
    return apiError(
      400,
      "cannot_reset",
      "That step cannot be reset right now.",
    );
  }

  logEvent("step_reset", { sessionId: session.id, stepNum });
  return Response.json({ ok: true });
}
