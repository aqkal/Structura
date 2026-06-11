import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { guardSession } from "@/lib/server/session-guard";
import { draftInput } from "@/lib/server/validators";
import { db, schema } from "@/lib/db";

import { noContent, parseBody } from "../shared";

/**
 * POST /api/session/{id}/draft
 *
 * Saves the student's in-progress answer onto the step row without
 * completing it. Missing or already completed steps are a silent
 * no-op; the route always answers 204 on valid input.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const body = await parseBody(req, draftInput);
  if (!body.ok) return body.response;
  const { stepNum: targetStep, text } = body.data;

  await db
    .update(schema.steps)
    .set({ userResponse: text })
    .where(
      and(
        eq(schema.steps.sessionId, session.id),
        eq(schema.steps.stepNum, targetStep),
        isNull(schema.steps.completedAt),
      ),
    );

  return noContent();
}
