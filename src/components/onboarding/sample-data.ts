import type { IntentionKey } from "@/lib/guided";

export type SampleKey = "power" | "ai-inequality" | "thesis";

export type SampleProblem = {
  key: SampleKey;
  subjectLabel: string;
  intention: IntentionKey;
  title: string;
  problem: string;
};

export const SAMPLE_PROBLEMS: SampleProblem[] = [
  {
    key: "power",
    subjectLabel: "Dive deep",
    intention: "dive-deep",
    title: "The psychology of power",
    problem:
      "How does holding power change the way a person thinks and behaves toward others?",
  },
  {
    key: "ai-inequality",
    subjectLabel: "Research question",
    intention: "research-question",
    title: "AI and inequality",
    problem:
      "I want to research how AI technologies might widen economic inequality, but my question is still far too broad.",
  },
  {
    key: "thesis",
    subjectLabel: "Strengthen argument",
    intention: "strengthen-argument",
    title: "Sharpen a weak thesis",
    problem:
      "My essay argues that social media does more harm than good, but my thesis feels vague and I want to make the argument stronger.",
  },
];

export function getSampleProblem(
  key: string | null | undefined,
): SampleProblem | null {
  if (!key) return null;
  return SAMPLE_PROBLEMS.find((s) => s.key === key) ?? null;
}
