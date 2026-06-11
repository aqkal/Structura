export type SampleKey = "algebra" | "physics" | "essay";

export type SampleProblem = {
  key: SampleKey;
  subjectSlug: string;
  subjectLabel: string;
  title: string;
  problem: string;
};

export const SAMPLE_PROBLEMS: SampleProblem[] = [
  {
    key: "algebra",
    subjectSlug: "algebra",
    subjectLabel: "Algebra",
    title: "A quadratic that will not factor",
    problem:
      "I need to solve 2x^2 - 5x - 3 = 0. I can handle simple equations, but the x^2 term throws me off and I am not sure where to even start.",
  },
  {
    key: "physics",
    subjectSlug: "physics",
    subjectLabel: "Physics",
    title: "Ball thrown straight up",
    problem:
      "A ball is thrown straight up at 12 m/s. I have to find how long it takes to come back to my hand, but I always mix up which kinematics equation to use.",
  },
  {
    key: "essay",
    subjectSlug: "other",
    subjectLabel: "Essay writing",
    title: "My thesis feels too vague",
    problem:
      "My essay asks whether social media does more harm than good. My thesis right now is 'social media has good and bad sides' and I know it is too vague, but I am stuck on how to sharpen it.",
  },
];

export function getSampleProblem(
  key: string | null | undefined,
): SampleProblem | null {
  if (!key) return null;
  return SAMPLE_PROBLEMS.find((s) => s.key === key) ?? null;
}
