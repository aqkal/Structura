import { generateText, smoothStream, streamText } from "ai";

import {
  DEFAULT_CHAT_MODEL,
  getModelById,
  isChatModelId,
  type ChatModelId,
} from "./provider";
import { renderPrompt } from "./prompts";

export type ChatFilePart = { data: Uint8Array; mediaType: string };

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  files?: ChatFilePart[];
};

export type ChatFinishInfo = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export type ChatStreamCallbacks = {
  signal?: AbortSignal;
  onFinish?: (info: ChatFinishInfo) => Promise<void> | void;
};

export function resolveChatModel(model?: string): ChatModelId {
  return model !== undefined && isChatModelId(model)
    ? model
    : DEFAULT_CHAT_MODEL;
}

const NO_THINKING = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
} as const;

const MAX_HISTORY_MESSAGES = 30;

function windowHistory(history: ChatTurn[]): ChatTurn[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return [
    { role: "user", content: "Earlier conversation omitted." },
    ...history.slice(-MAX_HISTORY_MESSAGES),
  ];
}

export function streamChatReply(
  history: ChatTurn[],
  opts?: { model?: string } & ChatStreamCallbacks,
) {
  const modelId = resolveChatModel(opts?.model);

  return streamText({
    model: getModelById(modelId),
    system: renderPrompt("chat", {}),
    messages: windowHistory(history).map((turn) => {
      if (turn.files && turn.files.length > 0) {
        return {
          role: turn.role,
          content: [
            { type: "text" as const, text: turn.content },
            ...turn.files.map((f) => ({
              type: "file" as const,
              data: f.data,
              mediaType: f.mediaType,
            })),
          ],
        };
      }
      return { role: turn.role, content: turn.content };
    }),
    temperature: 0.7,
    maxOutputTokens: 700,
    providerOptions: NO_THINKING,
    experimental_transform: smoothStream({ chunking: "word" }),
    abortSignal: opts?.signal,
    onFinish: async ({ text, usage }) => {
      if (!opts?.onFinish) return;
      await opts.onFinish({
        text,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        model: modelId,
      });
    },
  });
}

function fallbackTitle(firstUserMessage: string): string {
  const condensed = firstUserMessage.replace(/\s+/g, " ").trim();
  const words = condensed.split(" ").slice(0, 6).join(" ").slice(0, 48).trim();
  return words.length > 0 ? words : "New chat";
}

export async function generateChatTitle(
  firstUserMessage: string,
  modelId: string = DEFAULT_CHAT_MODEL,
): Promise<string> {
  try {
    const { text } = await generateText({
      model: getModelById(modelId),
      system:
        "You write a 2 to 5 word title for a tutoring conversation based on the student's first message. Output ONLY the title, no quotes, no punctuation at the end. Never use an em-dash.",
      messages: [{ role: "user" as const, content: firstUserMessage }],
      temperature: 0.3,
      maxOutputTokens: 24,
      providerOptions: NO_THINKING,
    });

    const cleaned = text
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim();

    if (cleaned.length > 0) return cleaned;
  } catch {
    // Quota or transient model failure: fall through to the text-derived
    // title rather than leaving the default name behind.
  }
  return fallbackTitle(firstUserMessage);
}
