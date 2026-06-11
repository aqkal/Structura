import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/server/api-error";
import { createChat } from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";

/** New chats a single user may create per minute. */
const CHATS_PER_MINUTE = 12;

/**
 * POST /api/chat
 *
 * Creates a new chat for the signed-in user and returns its id. The chat
 * starts with the default title ("New chat"); the title is set later from
 * the first message by the message route. An optional firstMessage is
 * accepted and validated for shape, but is not stored here: the message
 * route owns message persistence.
 */
const createChatInput = z.object({
  firstMessage: z.string().max(8000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = checkCustomLimit(`chatnew:${user.id}`, CHATS_PER_MINUTE);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const raw: unknown = await req.json().catch(() => null);
  // An empty body is fine: firstMessage is optional and not stored here.
  const parsed = createChatInput.safeParse(raw ?? {});
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return apiError(400, "bad_request", message);
  }

  const id = await createChat(user.id);
  return Response.json({ id });
}
