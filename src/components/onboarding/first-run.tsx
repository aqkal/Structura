"use client";

import { motion } from "framer-motion";

import { LinkButton } from "@/components/ui/button";
import { fadeUp, staggerContainer } from "@/lib/motion";

import { SampleProblemChips } from "./sample-problems";

const LOOP_STEPS = [
  "What do you know",
  "Where is it hard",
  "Try something concrete",
  "Find the principle",
  "Teach it back",
];

export function FirstRunPanel() {
  return (
    <motion.section
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="visible"
      className="glass flex flex-col gap-6 rounded-[var(--radius-lg)] p-[var(--space-6)]"
    >
      <motion.header variants={fadeUp} className="flex flex-col gap-2">
        <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
          Start here
        </div>
        <h2 className="font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-xl)]">
          Pick a problem. Feel how it works.
        </h2>
        <p
          className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]"
          style={{ maxWidth: "var(--reading-max)" }}
        >
          Grab a sample below or bring your own. Structura asks, you think.
        </p>
      </motion.header>

      <motion.div variants={fadeUp}>
        <SampleProblemChips />
      </motion.div>

      <motion.div variants={fadeUp}>
        <FiveStepLoop />
      </motion.div>

      <motion.div variants={fadeUp}>
        <LinkButton href="/session/new">
          Start with your own problem
          <ArrowGlyph />
        </LinkButton>
      </motion.div>
    </motion.section>
  );
}

function FiveStepLoop() {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
        Every session walks the same loop
      </span>
      <ol className="relative flex flex-col gap-3 sm:flex-row sm:gap-3">
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 left-[4.5px] w-px bg-[color:var(--border-ink)] sm:hidden"
        />
        <span
          aria-hidden="true"
          className="absolute top-[4.5px] right-2 left-2 hidden h-px bg-[color:var(--border-ink)] sm:block"
        />
        {LOOP_STEPS.map((name, i) => (
          <li
            key={name}
            className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-start sm:gap-2"
          >
            <motion.span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--mint-500)]"
              animate={{
                scale: [1, 1.4, 1],
                boxShadow: [
                  "0 0 0 0px rgba(58, 154, 106, 0)",
                  "0 0 0 5px rgba(58, 154, 106, 0.22)",
                  "0 0 0 0px rgba(58, 154, 106, 0)",
                ],
              }}
              transition={{
                duration: 0.9,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 3.6,
                delay: i * 0.9,
              }}
            />
            <span className="leading-snug font-medium text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]">
              {name}
            </span>
          </li>
        ))}
      </ol>
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
