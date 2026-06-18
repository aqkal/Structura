import type { ProofSummary } from "@/lib/server/ai/guided";
import { cn } from "@/lib/utils";

export function ProofCard({
  topic,
  summary,
  pasted,
  className,
}: {
  topic: string;
  summary: ProofSummary;
  pasted?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "glass mx-auto flex w-full max-w-[560px] flex-col gap-5 rounded-[var(--radius-lg)] p-6 md:p-8",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <span className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
          Reasoning proof
        </span>
        <h3 className="font-semibold tracking-[-0.01em] text-[color:var(--color-ink)] text-[var(--text-lg)]">
          {topic}
        </h3>
      </header>

      {summary.position && (
        <div className="flex flex-col gap-1 border-l-2 border-[color:var(--lavender-400)] pl-4">
          <span className="font-semibold tracking-widest text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
            Your position
          </span>
          <p className="text-[color:var(--color-ink)] text-[var(--text-sm)]">
            {summary.position}
          </p>
        </div>
      )}

      {summary.contributions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold tracking-widest text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
            What you contributed
          </span>
          <ul className="flex flex-col gap-1.5">
            {summary.contributions.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[color:var(--color-ink-muted)] text-[var(--text-sm)]"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-[color:var(--mint-300)] to-[color:var(--lavender-400)]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Ring label="Persist" earned={summary.persist} />
        <Ring label="Articulate" earned={summary.articulate} />
        {pasted && (
          <span className="rounded-full bg-[color:var(--lavender-100)]/80 px-3 py-1 font-medium text-[color:var(--lavender-800)] text-[var(--text-2xs)]">
            Dimmed (pasted)
          </span>
        )}
      </div>

      <p className="border-t border-[color:var(--border-soft)] pt-4 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
        Qualia {summary.qualiaDid.toLowerCase()}
      </p>
    </article>
  );
}

function Ring({ label, earned }: { label: string; earned: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-[var(--text-2xs)]",
        earned
          ? "bg-gradient-to-r from-[color:var(--mint-300)]/40 to-[color:var(--lavender-300)]/40 text-[color:var(--mint-700)]"
          : "bg-[color:var(--surface-2)] text-[color:var(--color-ink-subtle)]",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full border-2",
          earned
            ? "border-[color:var(--mint-500)] bg-[color:var(--mint-500)]/30"
            : "border-[color:var(--lavender-300)]",
        )}
      />
      {label}
    </span>
  );
}
