import { generateText, streamText } from "ai";

import {
  DEFAULT_CHAT_MODEL,
  getModelById,
  isChatModelId,
  type ChatModelId,
} from "./provider";
import { renderPrompt } from "./prompts";

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */

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

/**
 * Validate a requested chat model id against the allowlist, returning the
 * id that will actually be used. Exposed so the route can record the same
 * model string we bill and report under.
 */
export function resolveChatModel(model?: string): ChatModelId {
  return model !== undefined && isChatModelId(model)
    ? model
    : DEFAULT_CHAT_MODEL;
}

/**
 * Gemini 2.5 models think by default, and thought tokens count against
 * maxOutputTokens. Chat turns are short Socratic nudges; thinking adds
 * latency and silently eats the token caps. Disable it for every call.
 */
const NO_THINKING = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
} as const;

/* ------------------------------------------------------------------
   History windowing. Long conversations are capped before they reach
   the model: only the most recent turns are sent, with one synthetic
   note standing in for everything older. This bounds token growth in
   long chats. Only the model input is trimmed; the DB always keeps
   the full conversation.
   ------------------------------------------------------------------ */

/** Most recent conversation turns sent to the model per reply. */
const MAX_HISTORY_MESSAGES = 30;

function windowHistory(history: ChatTurn[]): ChatTurn[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  return [
    { role: "user", content: "Earlier conversation omitted." },
    ...history.slice(-MAX_HISTORY_MESSAGES),
  ];
}

/* ------------------------------------------------------------------
   Streaming chat reply (chat loop). Caller invokes .toTextStreamResponse().

   SECURITY INVARIANT: the system prompt is rendered only from safe,
   app-controlled content (chat.md, no interpolation). Everything the
   student wrote travels in user-role messages, which the prompt treats
   as untrusted data.
   ------------------------------------------------------------------ */

export function streamChatReply(
  history: ChatTurn[],
  opts?: { model?: string } & ChatStreamCallbacks,
) {
  const modelId = resolveChatModel(opts?.model);

  return streamText({
    model: getModelById(modelId),
    system: renderPrompt("chat", {}),
    messages: windowHistory(history).map((turn) => {
      // Only user turns carry files. When present, the message content
      // becomes a parts array: the text first, then each file part.
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

/* ------------------------------------------------------------------
   Chat title generation. One short, deterministic completion.
   ------------------------------------------------------------------ */

/**
 * Last-resort title derived from the student's own words, so a chat never
 * stays "New chat" just because the title model was unavailable.
 */
function fallbackTitle(firstUserMessage: string): string {
  const condensed = firstUserMessage.replace(/\s+/g, " ").trim();
  const words = condensed.split(" ").slice(0, 6).join(" ").slice(0, 48).trim();
  return words.length > 0 ? words : "New chat";
}

/**
 * Name the conversation with the SAME model the student is chatting with
 * (their picker choice), so the title voice matches the conversation. Falls
 * back to a text-derived title if that model is unavailable.
 */
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
