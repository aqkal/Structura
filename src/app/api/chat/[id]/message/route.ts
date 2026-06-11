import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  downloadAttachmentBytes,
  getAttachmentsByIds,
  linkAttachmentsToMessage,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_ATTACHMENT_BYTES,
} from "@/lib/server/attachments";
import {
  generateChatTitle,
  resolveChatModel,
  streamChatReply,
  type ChatTurn,
} from "@/lib/server/ai/chat";
import { guardChat } from "@/lib/server/chat-guard";
import {
  appendMessage,
  getChatMessages,
  setChatTitleIfDefault,
} from "@/lib/server/chats";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { beginUsage, checkDailyBudget, finishUsage } from "@/lib/server/usage";
import { findInjectionMarker } from "@/lib/server/validators";

import { aiBudgetHeaders, persistPartialReplyOnAbort } from "../shared";

/** Messages a single user may send per minute, on top of the per-IP cap. */
const MESSAGES_PER_MINUTE = 20;

/**
 * POST /api/chat/{id}/message
 *
 * Appends the student's message (optionally with image/PDF attachments),
 * then streams the assistant reply as text/plain. On finish the assistant
 * message is persisted, and if this was the first user message a title is
 * generated from it (only while the chat still holds the default title).
 * Budget gated: 429 ai_budget_exhausted when the daily cap is reached.
 *
 * Attachments are uploaded ahead of time via /upload, which returns ids.
 * Those ids are validated and linked to the just-created user message, and
 * their bytes are downloaded and passed to the model as file parts on the
 * final user turn.
 */
const messageInput = z.object({
  content: z.string().trim().min(1).max(8000),
  model: z.string().optional(),
  attachmentIds: z
    .array(z.string())
    .max(MAX_ATTACHMENTS_PER_MESSAGE)
    .optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const raw: unknown = await req.json().catch(() => null);
  const parsed = messageInput.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return apiError(400, "bad_request", message);
  }
  const { content, model, attachmentIds } = parsed.data;

  const marker = findInjectionMarker(content);
  if (marker) {
    // The chat prompt is injection resistant, so we log and proceed.
    logEvent("injection_marker", { route: "chat-message", chatId: id, marker });
  }

  // Per-user message rate limit, independent of the per-IP proxy cap so
  // users on a shared network are not lumped together and a single account
  // cannot flood message creation.
  const msgLimit = checkCustomLimit(`chatmsg:${user.id}`, MESSAGES_PER_MINUTE);
  if (!msgLimit.allowed) {
    return apiError(429, "message_rate_limited", "Slow down a moment.", {
      retryAfterSeconds: msgLimit.retryAfterSeconds,
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

  const modelId = resolveChatModel(model);

  // Resolve the requested attachments (chat-scoped) BEFORE appending, so a
  // bad attachment id never leaves a half-written message behind. Only the
  // attachments that belong to this chat are honored.
  const requestedIds = attachmentIds ?? [];
  const atts =
    requestedIds.length > 0 ? await getAttachmentsByIds(requestedIds, id) : [];

  // Cap the cumulative bytes sent to the model per turn so a conversation
  // cannot pull tens of MB of egress on every message.
  const totalAttachmentBytes = atts.reduce((sum, a) => sum + a.sizeBytes, 0);
  if (totalAttachmentBytes > MAX_MESSAGE_ATTACHMENT_BYTES) {
    return apiError(
      400,
      "attachments_too_large",
      "Those attachments are too large to send together.",
    );
  }

  const files: { data: Uint8Array; mediaType: string }[] = [];
  for (const att of atts) {
    const data = await downloadAttachmentBytes(att.storagePath);
    files.push({ data, mediaType: att.mediaType });
  }

  // Capture the prior conversation BEFORE appending the new message so we
  // can tell whether this is the very first user turn in the chat.
  const prior = await getChatMessages(id);
  const priorUserCount = prior.filter((m) => m.role === "user").length;
  const isFirstUserMessage = priorUserCount === 0;

  // appendMessage returns the new row id atomically, so attachments link to
  // exactly this message even under concurrent sends. Link immediately (not
  // in onFinish) so a stream failure still leaves them correctly associated.
  const userMessageId = await appendMessage(id, "user", content);
  if (atts.length > 0) {
    await linkAttachmentsToMessage(
      atts.map((a) => a.id),
      userMessageId,
      id,
    );
  }

  const history: ChatTurn[] = [
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content,
      files: files.length > 0 ? files : undefined,
    },
  ];

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
        if (isFirstUserMessage) {
          const title = await generateChatTitle(content, modelId);
          await setChatTitleIfDefault(id, title);
        }
        await finishUsage(usageId, info.inputTokens, info.outputTokens);
        logEvent("chat_reply", {
          chatId: id,
          model: modelId,
          inputTokens: info.inputTokens,
          outputTokens: info.outputTokens,
        });
      } catch (err) {
        logEvent("persist_failed", {
          route: "chat-message",
          chatId: id,
          errorName: errorName(err),
        });
      }
    },
  });

  // When the student stops the reply mid-stream, the client keeps the
  // partial text and marks the message done. Persist that same partial
  // text here so client and server agree after a Stop. The reserved
  // usage row keeps counting toward the budget (tokens stay unknown).
  persistPartialReplyOnAbort({
    textStream: result.textStream,
    signal: req.signal,
    route: "chat-message",
    chatId: id,
    finished: () => finished,
    persist: async (partialText) => {
      await appendMessage(id, "assistant", partialText);
      if (isFirstUserMessage) {
        const title = await generateChatTitle(content, modelId);
        await setChatTitleIfDefault(id, title);
      }
    },
  });

  return result.toTextStreamResponse({
    headers: aiBudgetHeaders(used + 1, budget),
  });
}
