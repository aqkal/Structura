"use client";

import { useActionState, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { createSessionAction } from "./actions";

const MAX_CHARS = 2000;
const COUNTER_WARN_AT = 1800;

const scaffoldModeOptions = [
  {
    value: "guided",
    name: "Guided",
    desc: "Questions with hints when you ask",
  },
  {
    value: "questions_only",
    name: "Questions only",
    desc: "No hints at all, pure questioning",
  },
  {
    value: "with_examples",
    name: "With examples",
    desc: "See a similar example after you try",
  },
] as const;

type ScaffoldModeValue = (typeof scaffoldModeOptions)[number]["value"];

const labelClass =
  "text-[var(--text-xs)] font-medium text-[color:var(--color-ink-muted)]";

const chipBase =
  "relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 " +
  "text-[var(--text-xs)] font-medium transition-colors duration-150";

export function NewSessionForm({
  subjects,
  initialProblem,
  initialSubjectSlug,
}: {
  subjects: Array<{ slug: string; label: string }>;
  initialProblem?: string;
  initialSubjectSlug?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createSessionAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prefilled = Boolean(initialProblem);
  const [problem, setProblem] = useState(initialProblem ?? "");
  const [subjectSlug, setSubjectSlug] = useState(() => {
    if (
      initialSubjectSlug &&
      subjects.some((s) => s.slug === initialSubjectSlug)
    ) {
      return initialSubjectSlug;
    }
    return subjects[0]?.slug ?? "";
  });
  const [scaffoldMode, setScaffoldMode] = useState<ScaffoldModeValue>("guided");

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="subjectSlug" value={subjectSlug} />
      <input type="hidden" name="scaffoldMode" value={scaffoldMode} />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="problemText" className={labelClass}>
            Your problem
          </label>
          <span
            className={cn(
              "text-[var(--text-2xs)] tabular-nums",
              problem.length > COUNTER_WARN_AT
                ? "text-[color:var(--lavender-800)]"
                : "text-[color:var(--color-ink-subtle)]",
            )}
          >
            {problem.length} / {MAX_CHARS}
          </span>
        </div>
        {prefilled && (
          <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
            We loaded a sample problem for you. Edit it, or clear it and write
            your own.
          </p>
        )}
        <textarea
          id="problemText"
          name="problemText"
          rows={5}
          maxLength={MAX_CHARS}
          required
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          placeholder="e.g. Find the limit of (x^2 - 1)/(x - 1) as x approaches 1"
          className={cn(
            "w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--border-soft)]",
            "bg-white/75 px-4 py-3 text-[color:var(--color-ink)]",
            "text-[16px] md:text-[var(--text-sm)]",
            "placeholder:text-[color:var(--color-ink-subtle)]",
            "transition-[background-color,box-shadow,border-color] duration-150",
            "focus:bg-white focus:shadow-[0_10px_30px_-18px_rgba(26,92,58,0.5)]",
            "focus:ring-2 focus:ring-[color:var(--lavender-400)]/60 focus:outline-none",
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Subject</span>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => {
            const selected = s.slug === subjectSlug;
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => setSubjectSlug(s.slug)}
                className={cn(
                  chipBase,
                  selected
                    ? "border-transparent text-[color:var(--color-bg)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--surface-2)] text-[color:var(--color-ink-muted)] hover:bg-white/60",
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="subject-selected"
                    transition={springSnappy}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[color:var(--mint-900)]"
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Scaffold mode</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {scaffoldModeOptions.map((m) => {
            const selected = m.value === scaffoldMode;
            return (
              <motion.button
                key={m.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setScaffoldMode(m.value)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={springSnappy}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-[var(--radius-md)] border p-4 pr-9 text-left transition-colors duration-150",
                  selected
                    ? "border-transparent"
                    : "border-[color:var(--border-soft)] bg-white/40 hover:bg-white/60",
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="scaffold-selected"
                    transition={springSnappy}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[var(--radius-md)] border border-[color:var(--mint-700)] bg-[color:var(--mint-100)]/70"
                  />
                )}
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={springSnappy}
                      aria-hidden="true"
                      className="absolute top-3 right-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--mint-700)] text-[color:var(--color-bg)]"
                    >
                      <CheckIcon />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="relative z-10 font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
                  {m.name}
                </span>
                <span className="relative z-10 leading-snug text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]">
                  {m.desc}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {state?.error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--lavender-300)] bg-[color:var(--lavender-100)]/80 px-4 py-3 text-[color:var(--lavender-800)] text-[var(--text-xs)]"
        >
          {state.error}
        </motion.div>
      )}

      <Button
        type="submit"
        size="lg"
        loading={pending}
        disabled={problem.trim().length === 0}
        className="w-full"
      >
        {pending ? (
          "Setting up your session"
        ) : (
          <>
            Start thinking
            <ArrowIcon />
          </>
        )}
      </Button>
    </form>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.5 5 9l4.5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
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
