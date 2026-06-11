import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { guardSession } from "@/lib/server/session-guard";
import { saveRetrospective } from "@/lib/server/sessions";
import {
  findInjectionMarker,
  retrospectiveInput,
} from "@/lib/server/validators";

import { noContent, parseBody } from "../shared";

/** Reflections a single user may save per minute. */
const RETROSPECTIVES_PER_MINUTE = 10;

/**
 * POST /api/session/{id}/retrospective
 *
 * Saves a post-session reflection. The table allows multiple
 * retrospectives per session, so each save appends a new row;
 * writtenAfterDays is computed server-side (0 when written on the same
 * UTC day as the session's completion or start, else the UTC day
 * difference). Answers 204 on success, like the other fire-and-forget
 * persistence routes.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const limit = checkCustomLimit(`retro:${user.id}`, RETROSPECTIVES_PER_MINUTE);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const body = await parseBody(req, retrospectiveInput);
  if (!body.ok) return body.response;
  const { content } = body.data;

  // Reflections are stored verbatim and never reach the model, but we
  // log injection markers for parity with the other text inputs.
  const marker = findInjectionMarker(content);
  if (marker) {
    logEvent("injection_marker", {
      route: "retrospective",
      sessionId: session.id,
      marker,
    });
  }

  const { writtenAfterDays } = await saveRetrospective(session, content);

  logEvent("retrospective_saved", {
    sessionId: session.id,
    writtenAfterDays,
    bodyLength: content.length,
  });

  return noContent();
}
