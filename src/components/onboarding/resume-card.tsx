"use client";

import { motion } from "framer-motion";

import { LinkButton } from "@/components/ui/button";
import { easeOutCurve, fadeUp, springSnappy } from "@/lib/motion";

export function ResumeCard({
  id,
  problemText,
  startedLabel,
  currentStep,
  totalSteps,
}: {
  id: string;
  problemText: string;
  startedLabel: string;
  currentStep: number;
  totalSteps: number;
}) {
  const stepNum = Math.max(currentStep, 1);
  const fraction = Math.min(Math.max(currentStep, 0) / totalSteps, 1);
  const widthPct = Math.max(fraction * 100, 4);

  return (
    <motion.div
      variants={fadeUp}
      transition={springSnappy}
      className="glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-[var(--space-6)]"
      style={{ maxWidth: "var(--reading-max)" }}
    >
      <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
        Continue where you left off
      </div>
      <p className="line-clamp-2 font-medium text-[color:var(--color-ink)] text-[var(--text-base)]">
        {problemText}
      </p>

      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={Math.max(currentStep, 0)}
          aria-label={`Step ${stepNum} of ${totalSteps}`}
          className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-[var(--radius-pill)] bg-white/55"
        >
          <motion.div
            className="h-full rounded-[var(--radius-pill)]"
            style={{
              background:
                "linear-gradient(90deg, var(--mint-300), var(--lavender-400))",
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.8, ease: easeOutCurve, delay: 0.35 }}
          />
        </div>
        <span className="shrink-0 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          step {stepNum} of {totalSteps}
        </span>
      </div>

      <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
        Started {startedLabel}
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <LinkButton href={`/session/${id}`}>
          Resume session
          <ArrowGlyph />
        </LinkButton>
        <LinkButton href="/session/new" variant="secondary">
          Start a new problem
        </LinkButton>
      </div>
    </motion.div>
  );
}

function ArrowGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
