import { z } from "zod";

export const scaffoldModes = [
  "guided",
  "questions_only",
  "with_examples",
] as const;

export const createSessionInput = z.object({
  problemText: z
    .string()
    .trim()
    .min(8, "Describe your problem in at least 8 characters.")
    .max(2000, "Keep it under 2000 characters."),
  subjectSlug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  scaffoldMode: z.enum(scaffoldModes),
});

export const stepNum = z.coerce.number().int().min(1).max(10);

/**
 * Optional student-picked model id, shared by the guided AI routes. The
 * AI layer validates it against the allowlist (unknown ids fall back to
 * the default model); here we only bound its shape.
 */
const modelChoice = z.string().max(64).optional();

export const nextStepInput = z.object({
  model: modelChoice,
});

export const feedbackInput = z.object({
  stepNum,
  response: z.string().trim().min(1).max(10000),
  model: modelChoice,
});

export const draftInput = z.object({
  stepNum,
  text: z.string().max(10000),
});

export const hintInput = z.object({
  stepNum,
  draft: z.string().max(10000).nullish(),
  model: modelChoice,
});

export const confidenceInput = z.object({
  point: z.enum(["start", "mid", "end"]),
  rating: z.coerce.number().int().min(1).max(5),
});

export const retrospectiveInput = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a sentence or two before saving.")
    .max(2000, "Keep it under 2000 characters."),
});

/**
 * Explicit jailbreak markers only. Kept deliberately short so normal
 * math or prose (e.g. "ignore the constant term") never trips it.
 */
const injectionMarkers = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "disregard your instructions",
  "</system>",
  "<|im_start|>",
  "you are now dan",
] as const;

/**
 * Case-insensitive scan for known prompt-injection markers.
 * Returns the matched marker, or null when the text looks clean.
 */
export function findInjectionMarker(text: string): string | null {
  const lower = text.toLowerCase();
  for (const marker of injectionMarkers) {
    if (lower.includes(marker)) return marker;
  }
  return null;
}
