/**
 * Client-safe mirror of the chat model allowlist.
 *
 * The server's `@/lib/server/ai/provider` module imports `@ai-sdk/google`,
 * which must never reach the browser bundle. Client components import THIS
 * file instead. Keep the ids in sync with the server allowlist: the server
 * still validates every requested model, so a drift here only affects the
 * labels shown in the picker, never what model actually runs.
 */
export type ChatModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-pro"
  | "gemini-3.5-flash"
  | "gemini-3.1-flash-lite-preview";

export const CHAT_MODELS: { id: ChatModelId; label: string; blurb: string }[] =
  [
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      blurb: "Balanced. The default.",
    },
    {
      id: "gemini-2.5-flash-lite",
      label: "Gemini 2.5 Flash Lite",
      blurb: "Fastest, lightest.",
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      blurb: "Most capable. May be slower.",
    },
    {
      id: "gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      blurb: "Newest flagship. May hit capacity limits.",
    },
    {
      id: "gemini-3.1-flash-lite-preview",
      label: "Gemini 3.1 Flash Lite",
      blurb: "Newest light model. Preview.",
    },
  ];

export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-2.5-flash";

/** Narrow an arbitrary value to a known chat model id. */
export function isChatModelId(value: unknown): value is ChatModelId {
  return typeof value === "string" && CHAT_MODELS.some((m) => m.id === value);
}
