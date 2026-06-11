import type { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/server/api-error";
import { getSessionForUser, type SessionRow } from "@/lib/server/sessions";

export type GuardOk = {
  ok: true;
  user: { id: string; email: string; name: string | null };
  session: SessionRow;
};

export type GuardFail = { ok: false; response: NextResponse };

/**
 * Auth + ownership gate for session-scoped route handlers.
 *
 * - No signed-in user: 401 unauthorized.
 * - Malformed uuid, missing session, or a session owned by someone
 *   else: 404 not_found. We never answer 403, so callers cannot probe
 *   whether a given session id exists.
 */
export async function guardSession(
  sessionId: string,
): Promise<GuardOk | GuardFail> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: apiError(401, "unauthorized") };
  }

  const session = await getSessionForUser(sessionId, user.id);
  if (!session) {
    return { ok: false, response: apiError(404, "not_found") };
  }

  return { ok: true, user, session };
}
