"use client";

import { AnimatePresence, motion } from "framer-motion";

import { durations, easeOutCurve } from "@/lib/motion";

const UNFILLED = "rgba(212, 197, 237, 0.3)"; /* lavender-300 at 30% */
const LEVEL_COLORS = [
  "#d4c5ed" /* lavender-300 */,
  "#b8a0d8" /* lavender-400 */,
  "#8fdcb0" /* mint-300 */,
  "#3a9a6a" /* mint-500 */,
];
const LABELS = ["Weak", "Okay", "Good", "Strong"];

export function scorePassword(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return password.length >= 8 ? score : Math.min(score, 1);
}

export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  const color = score > 0 ? LEVEL_COLORS[score - 1] : UNFILLED;
  const label = score > 0 ? LABELS[score - 1] : null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="h-1 flex-1 rounded-full"
              initial={false}
              animate={{ backgroundColor: i < score ? color : UNFILLED }}
              transition={{
                duration: durations.base,
                ease: easeOutCurve,
                delay: i * 0.04,
              }}
            />
          ))}
        </div>
        <div className="relative h-4 w-12">
          <AnimatePresence initial={false}>
            {label && (
              <motion.span
                key={label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durations.fast, ease: easeOutCurve }}
                className="absolute top-0 right-0 leading-4 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <span role="status" className="sr-only">
        {label ? `Password strength: ${label.toLowerCase()}` : ""}
      </span>
    </div>
  );
}

const REQUIREMENTS: {
  label: string;
  required: boolean;
  test: (p: string) => boolean;
}[] = [
  {
    label: "At least 8 characters",
    required: true,
    test: (p) => p.length >= 8,
  },
  {
    label: "Upper and lower case letters",
    required: false,
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  { label: "A number", required: false, test: (p) => /\d/.test(p) },
  {
    label: "A symbol",
    required: false,
    test: (p) => /[^a-zA-Z0-9]/.test(p),
  },
];

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-3.5 w-3.5 items-center justify-center"
      >
        {met ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <motion.path
              d="M2.5 6.5 5 9l4.5-6"
              stroke="var(--mint-500)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, ease: easeOutCurve }}
            />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--lavender-300)]/70" />
        )}
      </span>
      <motion.span
        initial={false}
        animate={{
          color: met ? "var(--color-ink-muted)" : "var(--color-ink-subtle)",
        }}
        transition={{ duration: durations.fast }}
        className="text-[var(--text-2xs)]"
      >
        {label}
      </motion.span>
    </li>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <AnimatePresence initial={false}>
      {password.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: durations.base, ease: easeOutCurve }}
          aria-label="Password requirements"
          className="flex flex-col gap-1 overflow-hidden"
        >
          {REQUIREMENTS.map((req) => (
            <RequirementRow
              key={req.label}
              met={req.test(password)}
              label={
                req.required ? req.label : `${req.label} (makes it stronger)`
              }
            />
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}

export function PasswordMatchHint({
  password,
  confirm,
}: {
  password: string;
  confirm: string;
}) {
  const state =
    confirm.length === 0 ? "empty" : password === confirm ? "match" : "differ";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state !== "empty" && (
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: durations.fast }}
          role="status"
          className="flex items-center gap-2 text-[var(--text-2xs)]"
        >
          {state === "match" ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <motion.path
                  d="M2.5 6.5 5 9l4.5-6"
                  stroke="var(--mint-500)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.25, ease: easeOutCurve }}
                />
              </svg>
              <span className="text-[color:var(--color-ink-muted)]">
                Passwords match
              </span>
            </>
          ) : (
            <span className="text-[color:var(--lavender-800)]">
              These don&apos;t match yet
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
