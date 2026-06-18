import { google } from "@ai-sdk/google";

export const MODEL_ID: string = process.env.AI_MODEL ?? "gemini-2.5-flash";

export const CHAT_MODELS = [
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
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-2.5-flash";

export function isChatModelId(value: unknown): value is ChatModelId {
  return typeof value === "string" && CHAT_MODELS.some((m) => m.id === value);
}

function assertGoogleProvider() {
  const provider = process.env.AI_PROVIDER;
  if (provider && provider !== "google") {
    throw new Error(
      `AI_PROVIDER is set to "${provider}", but only the "google" provider is wired so far. ` +
        `Unset AI_PROVIDER or set it to "google".`,
    );
  }
}

export function getModel() {
  assertGoogleProvider();
  return google(MODEL_ID);
}

export function getModelById(id: string) {
  assertGoogleProvider();
  const safe = isChatModelId(id) ? id : DEFAULT_CHAT_MODEL;
  return google(safe);
}

export function resolveModelId(id: string | null | undefined): string {
  return isChatModelId(id) ? id : MODEL_ID;
}
