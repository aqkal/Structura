import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/server/api-error";
import { createChat } from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";

const CHATS_PER_MINUTE = 12;

const createChatInput = z.object({
  firstMessage: z.string().max(8000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = await checkCustomLimit(`chatnew:${user.id}`, CHATS_PER_MINUTE);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const raw: unknown = await req.json().catch(() => null);

  const parsed = createChatInput.safeParse(raw ?? {});
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return apiError(400, "bad_request", message);
  }

  const id = await createChat(user.id);
  return Response.json({ id });
}
