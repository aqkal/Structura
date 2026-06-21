// BETA FEEDBACK (Tally). Temporary. See remove.md to tear this down after beta.
//
// One Tally form (lbgAON) surfaced two ways:
//  - Chat: after a number of prompts, a small popup links out to the form.
//  - Guided: after finishing a number of sessions, an embedded form appears.

export const FEEDBACK_EXTERNAL_URL = "https://tally.so/r/lbgAON";
export const FEEDBACK_EMBED_URL =
  "https://tally.so/embed/lbgAON?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";

export const CHAT_PROMPT_THRESHOLD = 7;
export const GUIDED_SESSION_THRESHOLD = 2;

export const LS_CHAT_PROMPT_COUNT = "qualia-feedback-chat-count";
export const LS_CHAT_DONE = "qualia-feedback-chat-done";
export const LS_GUIDED_SESSION_IDS = "qualia-feedback-guided-sessions";
export const LS_GUIDED_DONE = "qualia-feedback-guided-done";

// Counts a chat prompt and returns true when the popup should open: the
// threshold is reached and the user has not already been asked. Marking "done"
// happens when the popup actually opens, so it only ever shows once.
export function recordChatPromptAndMaybeAsk(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(LS_CHAT_DONE)) return false;
  const next =
    Number(window.localStorage.getItem(LS_CHAT_PROMPT_COUNT) ?? "0") + 1;
  window.localStorage.setItem(LS_CHAT_PROMPT_COUNT, String(next));
  return next >= CHAT_PROMPT_THRESHOLD;
}
