import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { saveMoveAnswer } from "@/lib/server/sessions";
import { findInjectionMarker, moveAnswerInput } from "@/lib/server/validators";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

import { noContent, parseBody } from "../shared";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { session } = guard;

  if (session.status !== "active") {
    return apiError(400, "session_not_active", "This session is finished.");
  }

  const body = await parseBody(req, moveAnswerInput);
  if (!body.ok) return body.response;
  const { stepNum, answer } = body.data;

  if (findInjectionMarker(answer)) {
    logEvent("injection_marker", { route: "answer", sessionId: session.id });
  }

  const [step] = await db
    .select({ id: schema.steps.id })
    .from(schema.steps)
    .where(
      and(
        eq(schema.steps.sessionId, session.id),
        eq(schema.steps.stepNum, stepNum),
      ),
    )
    .limit(1);
  if (!step) {
    return apiError(400, "no_such_move", "That move does not exist yet.");
  }

  await saveMoveAnswer({ sessionId: session.id, stepNum, answer });
  return noContent();
}
