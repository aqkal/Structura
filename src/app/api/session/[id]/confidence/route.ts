import type { NextRequest } from "next/server";

import { guardSession } from "@/lib/server/session-guard";
import { confidenceInput } from "@/lib/server/validators";
import { db, schema } from "@/lib/db";

import { noContent, parseBody } from "../shared";

/**
 * POST /api/session/{id}/confidence
 *
 * Upserts the confidence rating for a measurement point (start, mid,
 * end). Re-rating the same point overwrites the previous value.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const body = await parseBody(req, confidenceInput);
  if (!body.ok) return body.response;
  const { point, rating } = body.data;

  await db
    .insert(schema.confidenceRatings)
    .values({ sessionId: session.id, point, rating })
    .onConflictDoUpdate({
      target: [
        schema.confidenceRatings.sessionId,
        schema.confidenceRatings.point,
      ],
      set: { rating },
    });

  return noContent();
}
