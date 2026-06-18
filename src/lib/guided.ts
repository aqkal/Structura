export const INTENTION_KEYS = [
  "strengthen-argument",
  "dive-deep",
  "research-question",
] as const;

export type IntentionKey = (typeof INTENTION_KEYS)[number];

export type MoveKind =
  | "alternate-perspective"
  | "point-flaws"
  | "prompt-prior-knowledge"
  | "offer-context"
  | "offer-resources"
  | "topic-overview"
  | "identify-gap"
  | "draft-scaffold"
  | "suggest-improvement";

export type Intention = {
  key: IntentionKey;
  label: string;
  blurb: string;

  moves: MoveKind[];
};

export const INTENTIONS: Record<IntentionKey, Intention> = {
  "strengthen-argument": {
    key: "strengthen-argument",
    label: "Strengthen an argument",
    blurb:
      "Pressure-test a claim against counter-views and its own weak points.",
    moves: [
      "alternate-perspective",
      "point-flaws",
      "alternate-perspective",
      "point-flaws",
    ],
  },
  "dive-deep": {
    key: "dive-deep",
    label: "Dive deep into a topic",
    blurb: "Surface what you know, add context, and apply it.",
    moves: [
      "prompt-prior-knowledge",
      "offer-context",
      "offer-context",
      "offer-resources",
    ],
  },
  "research-question": {
    key: "research-question",
    label: "Formulate a research question",
    blurb: "Narrow a topic into a sharp, answerable research question.",
    moves: [
      "topic-overview",
      "identify-gap",
      "draft-scaffold",
      "suggest-improvement",
    ],
  },
};

export const INTENTION_LIST: Intention[] = INTENTION_KEYS.map(
  (k) => INTENTIONS[k],
);

export const DEFAULT_INTENTION: IntentionKey = "dive-deep";

export const MIN_MOVES_BEFORE_END = 3;

export function isIntentionKey(value: unknown): value is IntentionKey {
  return (
    typeof value === "string" &&
    (INTENTION_KEYS as readonly string[]).includes(value)
  );
}

export function totalStepsFor(key: IntentionKey): number {
  return INTENTIONS[key].moves.length;
}

export const MOVE_LABEL: Record<MoveKind, string> = {
  "alternate-perspective": "Alternate perspective",
  "point-flaws": "Where it's weak",
  "prompt-prior-knowledge": "What you know",
  "offer-context": "A piece of context",
  "offer-resources": "Where to look next",
  "topic-overview": "The landscape",
  "identify-gap": "The gap",
  "draft-scaffold": "Draft the question",
  "suggest-improvement": "Sharpen it",
};
