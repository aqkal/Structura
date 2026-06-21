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

import { streamWithFallback } from "@/lib/server/ai/fallback";

import { aiBudgetHeaders, persistPartialReplyOnAbort } from "../shared";

export const maxDuration = 60;

const MESSAGES_PER_MINUTE = 20;

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
    logEvent("injection_marker", { route: "chat-message", chatId: id, marker });
  }

  const msgLimit = await checkCustomLimit(
    `chatmsg:${user.id}`,
    MESSAGES_PER_MINUTE,
  );
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

  const requestedIds = attachmentIds ?? [];
  const atts =
    requestedIds.length > 0 ? await getAttachmentsByIds(requestedIds, id) : [];

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

  const prior = await getChatMessages(id);
  const priorUserCount = prior.filter((m) => m.role === "user").length;
  const isFirstUserMessage = priorUserCount === 0;

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

  let streamed: {
    stream: ReadableStream<string>;
    modelUsed: string;
    switched: boolean;
  };
  try {
    streamed = await streamWithFallback(modelId, (m) =>
      streamChatReply(history, {
        model: m,
        signal: req.signal,
        onFinish: async (info) => {
          finished = true;
          try {
            await appendMessage(id, "assistant", info.text);
            if (isFirstUserMessage) {
              const title = await generateChatTitle(content, info.model);
              await setChatTitleIfDefault(id, title);
            }
            await finishUsage(usageId, info.inputTokens, info.outputTokens);
            logEvent("chat_reply", {
              chatId: id,
              model: info.model,
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
      }),
    );
  } catch (err) {
    logEvent("chat_failed", {
      route: "chat-message",
      chatId: id,
      errorName: errorName(err),
    });
    return apiError(502, "ai_failed", "Could not generate a reply.");
  }

  const { stream, modelUsed, switched } = streamed;
  const [bodyStream, persistStream] = stream.tee();

  persistPartialReplyOnAbort({
    textStream: persistStream,
    signal: req.signal,
    route: "chat-message",
    chatId: id,
    finished: () => finished,
    persist: async (partialText) => {
      await appendMessage(id, "assistant", partialText);
      if (isFirstUserMessage) {
        const title = await generateChatTitle(content, modelUsed);
        await setChatTitleIfDefault(id, title);
      }
    },
  });

  return new Response(bodyStream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...aiBudgetHeaders(used + 1, budget),
      "x-ai-model": modelUsed,
      "x-ai-fallback": switched ? "1" : "0",
    },
  });
}
