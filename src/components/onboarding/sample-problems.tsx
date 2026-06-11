"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { SAMPLE_PROBLEMS } from "./sample-data";

const MotionLink = motion.create(Link);

export function SampleProblemCards({
  showSignInNote = false,
  className,
}: {
  showSignInNote?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SAMPLE_PROBLEMS.map((s) => (
          <MotionLink
            key={s.key}
            href={`/session/new?sample=${s.key}`}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={springSnappy}
            className="glass group flex min-h-[44px] flex-col gap-2.5 rounded-[var(--radius-lg)] p-[var(--space-5)]"
          >
            <span className="pill self-start text-[color:var(--lavender-800)]">
              {s.subjectLabel}
            </span>
            <span className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
              {s.title}
            </span>
            <span className="line-clamp-3 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
              {s.problem}
            </span>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-1 font-medium text-[color:var(--mint-700)] text-[var(--text-xs)]">
              Try this one
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              >
                <ArrowGlyph />
              </span>
            </span>
          </MotionLink>
        ))}
      </div>
      {showSignInNote && (
        <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          Tapping a problem asks you to sign in first. It only takes a moment.
        </p>
      )}
    </div>
  );
}

export function SampleProblemChips({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {SAMPLE_PROBLEMS.map((s) => (
        <MotionLink
          key={s.key}
          href={`/session/new?sample=${s.key}`}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={springSnappy}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)]",
            "border border-[color:var(--border-soft)] bg-white/60 px-4 py-2",
            "font-medium text-[color:var(--color-ink)] text-[var(--text-xs)]",
            "transition-colors hover:bg-white/85",
          )}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--mint-500)]"
          />
          {s.title}
          <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
            {s.subjectLabel}
          </span>
        </MotionLink>
      ))}
    </div>
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
