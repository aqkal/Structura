"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/render/markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "offline";

const MAX_HINTS_PER_STEP = 3;

type ActiveStepProps = {
  stepNum: number;
  totalSteps: number;
  question: string;
  isStreamingQuestion: boolean;
  hints: string[];
  streamingHint: string | null;
  hintsAllowed: boolean;
  hintBusy: boolean;
  draft: string;
  submitDisabled: boolean;
  saveState: SaveState;
  staleDraft: boolean;
  onDismissStale: () => void;
  onStop?: () => void;
  onDraftChange: (text: string) => void;
  onHint: () => void;
  onSubmit: () => void;
};

export function ActiveStep({
  stepNum,
  totalSteps,
  question,
  isStreamingQuestion,
  hints,
  streamingHint,
  hintsAllowed,
  hintBusy,
  draft,
  submitDisabled,
  saveState,
  staleDraft,
  onDismissStale,
  onStop,
  onDraftChange,
  onHint,
  onSubmit,
}: ActiveStepProps) {
  const allHints = streamingHint !== null ? [...hints, streamingHint] : hints;
  const hintsExhausted = hints.length >= MAX_HINTS_PER_STEP;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!submitDisabled) onSubmit();
    }
  }

  return (
    <div className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-5 ring-1 ring-[color:var(--lavender-300)]">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--lavender-400)] font-semibold text-[color:var(--lavender-800)] text-[var(--text-2xs)]">
          {stepNum}
        </div>
        <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
          Step {stepNum} of {totalSteps}
        </div>
      </div>

      <div
        className="min-h-[3.5rem]"
        aria-live="polite"
        aria-busy={isStreamingQuestion}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isStreamingQuestion && question.length === 0 ? (
            <motion.div
              key="skeleton"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2 pt-1"
            >
              <Skeleton className="h-4 w-[90%] bg-white/50" />
              <Skeleton className="h-4 w-[75%] bg-white/50" />
              <Skeleton className="h-4 w-[40%] bg-white/50" />
            </motion.div>
          ) : (
            <motion.div
              key="question"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <Markdown className="font-medium text-[color:var(--color-ink)] text-[var(--text-sm)]">
                {question}
              </Markdown>
              {isStreamingQuestion && question.length > 0 && (
                <span className="stream-caret" aria-hidden="true" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {allHints.length > 0 && (
        <div
          className="flex flex-col gap-2"
          aria-live="polite"
          aria-busy={streamingHint !== null}
        >
          <AnimatePresence initial={false}>
            {allHints.map((hint, i) => {
              const isStreamingThis =
                streamingHint !== null && i === allHints.length - 1;
              return (
                <motion.div
                  key={`hint-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-[var(--radius-md)] border border-[color:var(--lavender-300)]/50 bg-[color:var(--lavender-100)]/70 p-3"
                >
                  <div className="font-semibold tracking-widest text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
                    Hint {i + 1}
                  </div>
                  {hint ? (
                    <>
                      <Markdown className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                        {hint}
                      </Markdown>
                      {isStreamingThis && (
                        <span className="stream-caret" aria-hidden="true" />
                      )}
                    </>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <Skeleton className="h-3 w-[70%] bg-white/60" />
                      <Skeleton className="h-3 w-[45%] bg-white/60" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {isStreamingQuestion ? (
        <div className="flex items-center gap-3">
          <div className="relative h-[2px] flex-1 overflow-hidden rounded bg-[color:var(--lavender-300)]/30">
            <div className="thinking-bar absolute inset-y-0 w-2/5 rounded bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)]" />
          </div>
          {onStop && (
            <Button variant="ghost" size="sm" onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {staleDraft && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-2 overflow-hidden text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]"
              >
                <span>Editing your previous answer. Revise or rewrite.</span>
                <button
                  type="button"
                  onClick={onDismissStale}
                  aria-label="Dismiss"
                  className="rounded px-1 hover:text-[color:var(--color-ink)]"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your reasoning here. Think it through before you type."
            aria-label="Your reasoning"
            className={cn(
              "min-h-[120px] w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/70 p-4 text-[color:var(--color-ink)] text-[var(--text-sm)] transition-shadow duration-700 placeholder:text-[color:var(--color-ink-subtle)] focus:bg-white focus:ring-2 focus:ring-[color:var(--lavender-400)]/60 focus:outline-none",
              staleDraft && "ring-2 ring-[color:var(--lavender-400)]/50",
            )}
          />

          <div className="-mt-2 flex min-h-4 items-center justify-end">
            <SaveStatus state={saveState} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {hintsAllowed ? (
              <div className="flex items-center gap-2.5">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={onHint}
                  disabled={hintBusy || hintsExhausted}
                >
                  {hintBusy
                    ? "Thinking of a hint"
                    : hintsExhausted
                      ? "No hints left for this step"
                      : "I’m stuck, hint?"}
                </Button>
                <div
                  className="flex items-center gap-1"
                  aria-label={`${hints.length} of ${MAX_HINTS_PER_STEP} hints used`}
                >
                  {Array.from({ length: MAX_HINTS_PER_STEP }, (_, i) => (
                    <motion.span
                      key={i}
                      initial={false}
                      animate={{ scale: i < hints.length ? [1, 1.4, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        i < hints.length
                          ? "bg-[color:var(--lavender-600)]"
                          : "bg-[color:var(--lavender-300)]/40",
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                Hints are off in questions-only mode
              </span>
            )}
            <Button size="md" onClick={onSubmit} disabled={submitDisabled}>
              Continue
              <Arrow />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center gap-1 text-[var(--text-2xs)]",
          state === "offline"
            ? "text-[color:var(--lavender-800)]"
            : "text-[color:var(--color-ink-subtle)]",
        )}
      >
        {state === "saving" && "Saving…"}
        {state === "saved" && (
          <>
            <SavedTick />
            Saved
          </>
        )}
        {state === "offline" && "Saved on this device. Offline."}
      </motion.span>
    </AnimatePresence>
  );
}

function SavedTick() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <motion.path
        d="M2.5 6.5 5 9l4.5-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}

function Arrow() {
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
