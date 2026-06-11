"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { durations, easeOutCurve } from "@/lib/motion";

export function AuthError({
  message,
  attempt = 0,
}: {
  message: string | null;
  attempt?: number;
}) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {message && (
        <motion.p
          key={`${attempt}:${message}`}
          role="alert"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }}
          exit={{ opacity: 0, transition: { duration: durations.fast } }}
          transition={{ duration: 0.3, ease: easeOutCurve }}
          className="text-[color:var(--lavender-800)] text-[var(--text-xs)]"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function AuthStatus({ children }: { children: ReactNode }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durations.base, ease: easeOutCurve }}
      className="rounded-[var(--radius-md)] border border-[color:var(--mint-300)] bg-[color:var(--mint-100)]/70 px-4 py-3 leading-relaxed text-[color:var(--mint-900)] text-[var(--text-sm)]"
    >
      {children}
    </motion.div>
  );
}
