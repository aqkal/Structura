import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  downloadAttachmentBytes,
  listAttachmentsForChat,
} from "@/lib/server/attachments";
import {
  resolveChatModel,
  streamChatReply,
  type ChatFilePart,
  type ChatTurn,
} from "@/lib/server/ai/chat";
import { guardChat } from "@/lib/server/chat-guard";
import {
  appendMessage,
  deleteLastAssistantMessage,
  getChatMessages,
} from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { beginUsage, checkDailyBudget, finishUsage } from "@/lib/server/usage";

import { aiBudgetHeaders, persistPartialReplyOnAbort } from "../shared";

/** Regenerations a single user may request per minute. */
const REGENERATES_PER_MINUTE = 20;

/**
 * POST /api/chat/{id}/regenerate
 *
 * Deletes the chat's last assistant message (verified in a transaction;
 * 409 when the conversation does not end with an assistant reply) and
 * re-streams a fresh reply from the remaining history, persisting the
 * new assistant message exactly like the message route. The last user
 * message's attachments are re-attached so the regenerated reply sees
 * the same input the original one did. Budget gated like any reply.
 */
const regenerateInput = z.object({});

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
  const parsed = regenerateInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid request body.");
  }

  // Per-user limit, mirroring the message route's bucket style.
  const limit = checkCustomLimit(
    `chatregen:${user.id}`,
    REGENERATES_PER_MINUTE,
  );
  if (!limit.allowed) {
    return apiError(429, "message_rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const { allowed, used, budget } = await checkDailyBudget(user.id);
  if (!allowed) {
    return apiError(
      429,
      "budget_exceeded",
      "You have used today's AI budget. It resets at midnight UTC.",
    );
  }

  const messages = await getChatMessages(id);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") {
    return apiError(
      409,
      "nothing_to_regenerate",
      "There is no reply to regenerate yet.",
    );
  }

  // The remaining history the new reply is generated from.
  const remaining = messages.slice(0, -1);

  // Find the student's latest message so its attachments can be passed
  // to the model again, just like the original send did.
  let lastUserIdx = -1;
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) {
    return apiError(
      409,
      "nothing_to_regenerate",
      "There is no reply to regenerate yet.",
    );
  }
  const lastUserMessage = remaining[lastUserIdx];

  // Download attachment bytes BEFORE deleting anything, so a storage
  // hiccup leaves the conversation untouched and the action retryable.
  const files: ChatFilePart[] = [];
  const chatAttachments = await listAttachmentsForChat(id);
  for (const att of chatAttachments) {
    if (att.messageId !== lastUserMessage.id) continue;
    const data = await downloadAttachmentBytes(att.storagePath);
    files.push({ data, mediaType: att.mediaType });
  }

  // Transactional verify-and-delete: if the conversation moved on since
  // we read it (a concurrent send or regenerate), nothing is deleted.
  const deleted = await deleteLastAssistantMessage(id, last.id);
  if (!deleted) {
    return apiError(
      409,
      "nothing_to_regenerate",
      "There is no reply to regenerate yet.",
    );
  }

  const modelId = resolveChatModel();

  const history: ChatTurn[] = remaining.map((m, i) => ({
    role: m.role,
    content: m.content,
    files: i === lastUserIdx && files.length > 0 ? files : undefined,
  }));

  const usageId = await beginUsage({
    userId: user.id,
    kind: "chat",
    model: modelId,
  });

  let finished = false;
  const result = streamChatReply(history, {
    model: modelId,
    signal: req.signal,
    onFinish: async (info) => {
      finished = true;
      try {
        await appendMessage(id, "assistant", info.text);
        await finishUsage(usageId, info.inputTokens, info.outputTokens);
        logEvent("chat_reply", {
          chatId: id,
          model: modelId,
          regenerated: true,
          inputTokens: info.inputTokens,
          outputTokens: info.outputTokens,
        });
      } catch (err) {
        logEvent("persist_failed", {
          route: "chat-regenerate",
          chatId: id,
          errorName: errorName(err),
        });
      }
    },
  });

  // Keep client and server in agreement when the student stops the
  // regenerated reply mid-stream: persist the partial text they kept.
  persistPartialReplyOnAbort({
    textStream: result.textStream,
    signal: req.signal,
    route: "chat-regenerate",
    chatId: id,
    finished: () => finished,
    persist: async (partialText) => {
      await appendMessage(id, "assistant", partialText);
    },
  });

  return result.toTextStreamResponse({
    headers: aiBudgetHeaders(used + 1, budget),
  });
}
