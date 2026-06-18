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

export const maxDuration = 60;

const REGENERATES_PER_MINUTE = 20;

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

  const parsed = regenerateInput.safeParse(raw ?? {});
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid request body.");
  }

  const limit = await checkCustomLimit(
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

  const remaining = messages.slice(0, -1);

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

  const files: ChatFilePart[] = [];
  const chatAttachments = await listAttachmentsForChat(id);
  for (const att of chatAttachments) {
    if (att.messageId !== lastUserMessage.id) continue;
    const data = await downloadAttachmentBytes(att.storagePath);
    files.push({ data, mediaType: att.mediaType });
  }

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
