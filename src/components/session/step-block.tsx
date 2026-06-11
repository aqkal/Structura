"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/render/markdown";
import { springSnappy } from "@/lib/motion";

export type CompletedStep = {
  stepNum: number;
  question: string;
  userResponse: string | null;
  aiFeedback: string | null;
  revisionCount?: number;
};

export function StepBlock({
  step,
  hints,
  onTryAgain,
  disabled,
}: {
  step: CompletedStep;
  hints: string[];
  onTryAgain: () => void;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!confirming) return;
    function onPointerDown(e: PointerEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setConfirming(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirming(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirming]);

  const attempts = step.revisionCount ?? 0;

  return (
    <div className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--mint-700)] font-semibold text-[color:var(--color-bg)] text-[var(--text-2xs)]">
          {step.stepNum}
        </div>
        <Markdown className="min-w-0 font-medium text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          {step.question}
        </Markdown>
        {attempts > 0 && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springSnappy}
            className="ml-auto shrink-0 rounded-full bg-[color:var(--lavender-200)]/70 px-2.5 py-0.5 font-medium text-[color:var(--lavender-800)] text-[var(--text-2xs)]"
          >
            attempt {attempts + 1}
          </motion.span>
        )}
      </div>

      {step.userResponse !== null && (
        <div className="rounded-[var(--radius-md)] bg-white/55 p-4 whitespace-pre-wrap text-[color:var(--color-ink)] text-[var(--text-sm)]">
          {step.userResponse}
        </div>
      )}

      {hints.length > 0 && (
        <details className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
          <summary className="cursor-pointer select-none">
            {hints.length === 1 ? "1 hint used" : `${hints.length} hints used`}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {hints.map((hint, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-md)] border border-[color:var(--lavender-300)]/50 bg-[color:var(--lavender-100)]/70 p-3"
              >
                <div className="font-semibold tracking-widest text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
                  Hint {i + 1}
                </div>
                <Markdown className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                  {hint}
                </Markdown>
              </div>
            ))}
          </div>
        </details>
      )}

      {step.aiFeedback !== null && (
        <div className="flex flex-col gap-1 border-l-2 border-[color:var(--lavender-400)] pl-4">
          <div className="font-semibold tracking-widest text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
            Structura
          </div>
          <Markdown className="text-[var(--text-sm)]">
            {step.aiFeedback}
          </Markdown>
        </div>
      )}

      <div className="flex min-h-9 items-center justify-between">
        <div className="flex items-center gap-2 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          <span
            aria-hidden="true"
            className="h-[6px] w-[6px] rounded-full bg-[color:var(--mint-500)]"
          />
          Logged
        </div>
        {!disabled && (
          <div className="relative" ref={popoverRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming((c) => !c)}
              aria-expanded={confirming}
            >
              Try again
            </Button>
            <AnimatePresence>
              {confirming && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="glass absolute right-0 bottom-full z-10 mb-2 w-64 rounded-[var(--radius-md)] p-3 text-left shadow-[var(--shadow-card)]"
                >
                  <p className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
                    This clears this step&apos;s feedback and any later steps.
                    Your answer stays in the editor.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        setConfirming(false);
                        onTryAgain();
                      }}
                    >
                      Rewrite this step
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
