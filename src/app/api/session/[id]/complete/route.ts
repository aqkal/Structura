import { NextResponse, type NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { markSessionComplete } from "@/lib/server/sessions";

import { completedSteps, loadSteps } from "../shared";

/** Sessions of 45 minutes or more count as deep work. */
const DEEP_SESSION_SECONDS = 2700;

/**
 * POST /api/session/{id}/complete
 *
 * Marks the session completed once every step is done. Idempotent:
 * calling it again returns the stored elapsed time.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const steps = await loadSteps(session.id);
  const completedCount = completedSteps(steps).length;
  if (completedCount !== session.totalSteps) {
    return apiError(
      400,
      "not_finished",
      "Complete all steps before finishing the session.",
    );
  }

  const result = await markSessionComplete(session.id, user.id);
  if (!result) {
    return apiError(404, "not_found");
  }

  const deepSession = result.elapsedSeconds >= DEEP_SESSION_SECONDS;
  logEvent("session_completed", {
    sessionId: session.id,
    elapsedSeconds: result.elapsedSeconds,
  });

  return NextResponse.json({
    ok: true,
    elapsedSeconds: result.elapsedSeconds,
    deepSession,
  });
}
