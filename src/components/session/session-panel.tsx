"use client";

type ScaffoldMode = "guided" | "questions_only" | "with_examples";

const modeMeta: Record<ScaffoldMode, { name: string; desc: string }> = {
  guided: {
    name: "Guided",
    desc: "Structured questions with feedback at every step.",
  },
  questions_only: {
    name: "Questions only",
    desc: "Pure questions. No hints, no worked examples.",
  },
  with_examples: {
    name: "With examples",
    desc: "Questions plus a short example when you ask for help.",
  },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] py-2 last:border-0">
      <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
        {label}
      </span>
      <span className="font-semibold text-[color:var(--color-ink)] text-[var(--text-xs)]">
        {value}
      </span>
    </div>
  );
}

export function SessionPanel({
  scaffoldMode,
  stepsDone,
  totalSteps,
  rewrites,
  aiUsage = null,
}: {
  scaffoldMode: ScaffoldMode;
  stepsDone: number;
  totalSteps: number;
  rewrites: number;
  aiUsage?: { used: number; budget: number } | null;
}) {
  const meta = modeMeta[scaffoldMode];
  const showBudget =
    aiUsage !== null &&
    aiUsage.budget > 0 &&
    aiUsage.used / aiUsage.budget >= 0.5;
  const nearLimit = showBudget && aiUsage.used / aiUsage.budget >= 0.9;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-4">
        <Label>Scaffolding</Label>
        <div className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
          {meta.name}
        </div>
        <p className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
          {meta.desc}
        </p>
        <div className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          Chosen at start
        </div>
      </div>

      <div className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-4">
        <Label>This session</Label>
        <div className="flex flex-col">
          <StatRow label="Steps done" value={`${stepsDone}/${totalSteps}`} />
          <StatRow label="Rewrites" value={String(rewrites)} />
        </div>
      </div>

      {showBudget && (
        <div className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-4">
          <Label>AI calls today</Label>
          <div className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
            {aiUsage.used} of {aiUsage.budget}
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-[color:var(--lavender-300)]/20">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((aiUsage.used / aiUsage.budget) * 100))}%`,
                background: nearLimit
                  ? "var(--lavender-800)"
                  : "var(--mint-500)",
              }}
            />
          </div>
          <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
            Resets at midnight UTC.
          </p>
        </div>
      )}
    </div>
  );
}
