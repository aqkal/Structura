"use client";

import { useActionState, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_INTENTION,
  INTENTION_LIST,
  type IntentionKey,
} from "@/lib/guided";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { createSessionAction } from "./actions";

const MAX_CHARS = 2000;
const COUNTER_WARN_AT = 1800;

const labelClass =
  "text-[var(--text-xs)] font-medium text-[color:var(--color-ink-muted)]";

export function NewSessionForm({
  initialTopic,
  initialIntention,
}: {
  initialTopic?: string;
  initialIntention?: IntentionKey;
}) {
  const [state, formAction, pending] = useActionState(
    createSessionAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const prefilled = Boolean(initialTopic);
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [intention, setIntention] = useState<IntentionKey>(
    initialIntention ?? DEFAULT_INTENTION,
  );

  function onTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="intention" value={intention} />

      <div className="flex flex-col gap-8">
        <span className={labelClass}>How do you want to approach it?</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {INTENTION_LIST.map((it) => {
            const selected = it.key === intention;
            return (
              <motion.button
                key={it.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setIntention(it.key)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={springSnappy}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-[var(--radius-md)] border p-5 pr-10 text-left transition-colors duration-150",
                  selected
                    ? "border-transparent"
                    : "border-[color:var(--border-soft)] bg-white/40 hover:bg-white/60",
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="intention-selected"
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
                  {it.label}
                </span>
                <span className="relative z-10 leading-snug text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]">
                  {it.blurb}
                </span>
                <span className="relative z-10 mt-0.5 font-semibold tracking-[0.14em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
                  {it.moves.length} moves
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="topic" className={labelClass}>
            Your topic
          </label>
          <span
            className={cn(
              "text-[var(--text-2xs)] tabular-nums",
              topic.length > COUNTER_WARN_AT
                ? "text-[color:var(--lavender-800)]"
                : "text-[color:var(--color-ink-subtle)]",
            )}
          >
            {topic.length} / {MAX_CHARS}
          </span>
        </div>
        {prefilled && (
          <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
            We loaded a sample topic for you. Edit it, or clear it and write
            your own.
          </p>
        )}
        <textarea
          id="topic"
          name="topic"
          rows={4}
          maxLength={MAX_CHARS}
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          placeholder="e.g. The psychology of power, algorithmic bias, free will, your essay thesis..."
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={topic.trim().length < 10}
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
        <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
          Qualia asks the questions. You do the thinking.
        </span>
      </div>
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
