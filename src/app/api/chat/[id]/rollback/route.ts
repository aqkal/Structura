import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { removeStorageObjects } from "@/lib/server/attachments";
import { guardChat } from "@/lib/server/chat-guard";
import { rollbackLastUserMessage } from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** Rollbacks a single user may request per minute. */
const ROLLBACKS_PER_MINUTE = 20;

/**
 * POST /api/chat/{id}/rollback
 *
 * Edit-and-resend support: in one transaction, deletes the chat's last
 * user message, every assistant message after it, and its attachment
 * rows (FK cascade), then clears the matching storage objects best
 * effort. Returns the deleted user text so the client can refill the
 * composer. No AI call, no budget use. 409 when the chat holds no user
 * message.
 */
const rollbackInput = z.object({});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const raw: unknown = await req.json().catch(() => null);
  // The body carries no fields; an empty body is fine too.
  const parsed = rollbackInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid request body.");
  }

  // Per-user limit, mirroring the message route's bucket style.
  const limit = checkCustomLimit(
    `chatrollback:${user.id}`,
    ROLLBACKS_PER_MINUTE,
  );
  if (!limit.allowed) {
    return apiError(429, "message_rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const result = await rollbackLastUserMessage(id);
  if (!result) {
    return apiError(
      409,
      "nothing_to_rollback",
      "There is no message to take back yet.",
    );
  }

  // Best-effort storage cleanup with the user's own session client;
  // failures are logged inside the helper and never block the rollback.
  if (result.attachmentPaths.length > 0) {
    const supabase = await createClient();
    await removeStorageObjects(supabase, result.attachmentPaths);
  }

  logEvent("chat_rollback", {
    chatId: id,
    deletedMessages: result.deletedMessages,
    attachments: result.attachmentPaths.length,
  });

  return Response.json({ ok: true, userContent: result.userContent });
}
