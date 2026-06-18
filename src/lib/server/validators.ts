import { z } from "zod";

export const topicInput = z.object({
  topic: z
    .string()
    .trim()
    .min(10, "Add a little more detail (at least 10 characters).")
    .max(2000, "Keep it under 2000 characters."),
});

export const moveAnswerInput = z.object({
  stepNum: z.coerce.number().int().min(0).max(11),
  answer: z.string().trim().min(1).max(10000),
  pasted: z.boolean().optional(),
});

const injectionMarkers = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "disregard your instructions",
  "</system>",
  "<|im_start|>",
  "you are now dan",
] as const;

export function findInjectionMarker(text: string): string | null {
  const lower = text.toLowerCase();
  for (const marker of injectionMarkers) {
    if (lower.includes(marker)) return marker;
  }
  return null;
}
