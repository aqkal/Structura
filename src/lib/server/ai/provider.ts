import { google } from "@ai-sdk/google";

/**
 * The model id every AI call uses. Override with AI_MODEL when a new
 * model ships; gemini-2.5-flash is the verified-working free-tier default.
 */
export const MODEL_ID: string = process.env.AI_MODEL ?? "gemini-2.5-flash";

/**
 * Models a student may pick in chat mode. This is an ALLOWLIST: the chat
 * route validates the requested model against it, so a crafted request can
 * never make us call an arbitrary or surprise-billing model. Adding another
 * provider later means importing its adapter and extending `getModelById`.
 */
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

/**
 * Resolve the language model for the structured loop and other internal
 * calls. Always uses MODEL_ID.
 */
export function getModel() {
  assertGoogleProvider();
  return google(MODEL_ID);
}

/**
 * Resolve a chat model by id. Falls back to the default if the id is not
 * on the allowlist, so a bad value degrades safely instead of erroring.
 */
export function getModelById(id: string) {
  assertGoogleProvider();
  const safe = isChatModelId(id) ? id : DEFAULT_CHAT_MODEL;
  return google(safe);
}

/**
 * Resolve an optional, untrusted model id to a safe model id string.
 * Allowlisted ids pass through; anything else becomes MODEL_ID. Used by
 * the guided-session routes, which accept the same model picker values
 * as chat but must never call an arbitrary model.
 */
export function resolveModelId(id: string | null | undefined): string {
  return isChatModelId(id) ? id : MODEL_ID;
}
