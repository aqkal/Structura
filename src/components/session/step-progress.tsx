"use client";

import { motion } from "framer-motion";

import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STEP_LABELS = [
  "What do you know",
  "Where is it hard",
  "Try something concrete",
  "Find the principle",
  "Teach it back",
];

export function StepProgress({
  total,
  completed,
  activeStep,
  halfStep = false,
}: {
  total: number;
  completed: number;
  activeStep: number | null;
  halfStep?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`Progress: ${completed} of ${total} steps complete`}
      className="flex w-full items-center"
    >
      {Array.from({ length: total }, (_, i) => {
        const num = i + 1;
        const isDone = num <= completed;
        const isActive = activeStep === num;
        const label = STEP_LABELS[i] ?? `Step ${num}`;
        const connectorFrac =
          num + 1 <= completed ? 1 : num === completed && halfStep ? 0.5 : 0;

        return (
          <div
            key={num}
            className={cn("flex items-center", i < total - 1 && "flex-1")}
          >
            <div className="relative" title={label}>
              {isActive && (
                <>
                  <motion.span
                    layoutId="active-step-ring"
                    transition={springSoft}
                    className="absolute -inset-[5px] rounded-full border border-[color:var(--lavender-400)]"
                  />
                  <motion.span
                    aria-hidden="true"
                    className="absolute -inset-[5px] rounded-full border border-[color:var(--lavender-400)]/70"
                    animate={{
                      scale: [1, 1.25, 1],
                      opacity: [0.55, 0.1, 0.55],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </>
              )}
              <div
                aria-label={`Step ${num} of ${total}: ${label}`}
                className={cn(
                  "relative flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-semibold",
                  isDone
                    ? "bg-gradient-to-br from-[color:var(--mint-300)] to-[color:var(--lavender-400)] text-[#0d3320]"
                    : isActive
                      ? "border border-[color:var(--lavender-400)] bg-[color:var(--surface-1)] text-[color:var(--lavender-800)]"
                      : "border border-[color:var(--lavender-300)]/40 text-[color:var(--color-ink-subtle)]",
                )}
              >
                {isDone ? <Check /> : num}
              </div>
            </div>

            {i < total - 1 && (
              <div className="mx-1.5 h-[3px] flex-1 overflow-hidden rounded-full bg-[color:var(--lavender-300)]/20 sm:mx-2">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)]"
                  initial={false}
                  animate={{ scaleX: connectorFrac }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Check() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <motion.path
        d="M2.5 6.5 5 9l4.5-6"
        stroke="#0d3320"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
}
