"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfidenceTrack({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = value !== null && n <= value;
          return (
            <motion.button
              key={n}
              type="button"
              aria-label={`Confidence ${n} of 5`}
              aria-pressed={filled}
              onClick={() => onChange(n)}
              whileTap={{ scale: 0.92 }}
              animate={{ scale: value === n ? [1, 1.12, 1] : 1 }}
              transition={{ duration: 0.25 }}
              style={{ transitionDelay: filled ? `${n * 40}ms` : "0ms" }}
              className={cn(
                "h-2.5 min-h-[24px] flex-1 rounded-full py-2.5 transition-colors duration-150",
                filled
                  ? "bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)]"
                  : "bg-[color:var(--lavender-300)]/30 hover:bg-[color:var(--lavender-300)]/60",
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
        <span>Lost</span>
        <span>Got it</span>
      </div>
    </div>
  );
}

export function ConfidenceGate({
  prompt,
  onSubmit,
  busy,
}: {
  prompt: string;
  onSubmit: (rating: number) => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState<number | null>(null);

  return (
    <div className="glass flex flex-col gap-5 rounded-[var(--radius-lg)] p-6">
      <div className="font-medium text-[color:var(--color-ink)] text-[var(--text-base)]">
        {prompt}
      </div>
      <ConfidenceTrack value={value} onChange={setValue} />
      <div>
        <motion.div
          className="inline-block rounded-full"
          initial={false}
          animate={
            value !== null
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(184, 160, 216, 0)",
                    "0 0 0 7px rgba(184, 160, 216, 0.25)",
                    "0 0 0 0 rgba(184, 160, 216, 0)",
                  ],
                }
              : { boxShadow: "0 0 0 0 rgba(184, 160, 216, 0)" }
          }
          transition={{ duration: 0.9 }}
        >
          <Button
            size="md"
            disabled={value === null}
            loading={busy}
            onClick={() => {
              if (value !== null) onSubmit(value);
            }}
          >
            {busy ? "Saving" : "Continue"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
