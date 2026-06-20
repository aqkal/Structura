export type ChatModelId = "gemini-2.5-flash";

export const CHAT_MODELS: { id: ChatModelId; label: string; blurb: string }[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    blurb: "Balanced. The default.",
  },
];

export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-2.5-flash";

export function isChatModelId(value: unknown): value is ChatModelId {
  return typeof value === "string" && CHAT_MODELS.some((m) => m.id === value);
}