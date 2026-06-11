import type { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/server/api-error";
import { getChatForUser, type ChatRow } from "@/lib/server/chats";

export type ChatGuardOk = {
  ok: true;
  user: { id: string; email: string; name: string | null };
  chat: ChatRow;
};

export type ChatGuardFail = { ok: false; response: NextResponse };

/**
 * Auth + ownership gate for chat-scoped route handlers.
 *
 * - No signed-in user: 401 unauthorized.
 * - Malformed uuid, missing chat, or a chat owned by someone else: 404
 *   not_found. We never answer 403, so callers cannot probe whether a
 *   given chat id exists.
 */
export async function guardChat(
  chatId: string,
): Promise<ChatGuardOk | ChatGuardFail> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: apiError(401, "unauthorized") };
  }

  const chat = await getChatForUser(chatId, user.id);
  if (!chat) {
    return { ok: false, response: apiError(404, "not_found") };
  }

  return { ok: true, user, chat };
}
