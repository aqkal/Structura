import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { guardSession } from "@/lib/server/session-guard";
import { deleteSessionForUser } from "@/lib/server/sessions";

/** Session deletions a single user may perform per minute. */
const DELETES_PER_MINUTE = 12;

/**
 * DELETE /api/session/{id} -> delete the session. 200 { ok: true }.
 *
 * Auth + ownership gated by guardSession, which answers 401 when no
 * user is signed in and 404 for a missing, malformed, or unowned id.
 * Cascading foreign keys clear the session's steps, hints, confidence
 * ratings, and retrospectives; usage_events rows survive with their
 * session_id set to null.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const limit = checkCustomLimit(`sessiondel:${user.id}`, DELETES_PER_MINUTE);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const deleted = await deleteSessionForUser(session.id, user.id);
  if (!deleted) return apiError(404, "not_found");

  logEvent("session_deleted", { sessionId: session.id });
  return Response.json({ ok: true });
}
