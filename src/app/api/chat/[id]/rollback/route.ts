import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { removeStorageObjects } from "@/lib/server/attachments";
import { guardChat } from "@/lib/server/chat-guard";
import { rollbackLastUserMessage } from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";

const ROLLBACKS_PER_MINUTE = 20;

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

  const parsed = rollbackInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid request body.");
  }

  const limit = await checkCustomLimit(
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
