"use client";

import { motion } from "framer-motion";

import { easeOutCurve, fadeUp, staggerContainer } from "@/lib/motion";

const STEP_DOTS = ["Know", "Stuck", "Try", "Principle", "Teach"];

export function HowItWorks() {
  return (
    <motion.section
      className="flex flex-col gap-4"
      variants={staggerContainer(0.12, 0.05)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      <motion.h2
        variants={fadeUp}
        className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase"
      >
        How it works
      </motion.h2>

      <div className="relative">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            num={1}
            title="Bring a hard problem"
            desc="Type it in plain language. Math, physics, code, an essay you are stuck on. Any subject."
            visual={<TypedProblem />}
          />
          <Card
            num={2}
            title="Reason in five steps"
            desc="Qualia asks, you think. What do you know, where is it hard, try it, find the principle, teach it back. Hints only when you ask, answers never."
            visual={<FiveSteps />}
          />
          <Card
            num={3}
            title="Guided or Chat, your call"
            desc="Work the structured five-step session, or talk it through in a free-form Socratic chat. Switch any time from the top bar."
            visual={<ModeSwitchDemo />}
          />
        </div>
      </div>
    </motion.section>
  );
}

function Card({
  num,
  title,
  desc,
  visual,
}: {
  num: number;
  title: string;
  desc: string;
  visual: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-[var(--space-5)]"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--mint-300)] to-[color:var(--lavender-400)] text-[11px] font-semibold text-[#0d3320]"
        >
          {num}
        </span>
        <div className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
          {title}
        </div>
      </div>

      <div className="flex h-12 items-center" aria-hidden="true">
        {visual}
      </div>

      <p className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
        {desc}
      </p>
    </motion.div>
  );
}

function TypedProblem() {
  return (
    <div className="flex h-9 w-full items-center rounded-[var(--radius-pill)] border border-[color:var(--border-soft)] bg-white/55 px-3">
      <motion.span
        className="h-2 max-w-full rounded-full bg-[color:var(--color-ink-subtle)]/40"
        variants={{
          hidden: { width: 0 },
          visible: {
            width: "72%",
            transition: { duration: 0.9, ease: easeOutCurve, delay: 0.35 },
          },
        }}
      />
      <span className="stream-caret" />
    </div>
  );
}

function FiveSteps() {
  return (
    <div className="flex w-full items-center">
      {STEP_DOTS.map((label, i) => (
        <div
          key={label}
          className={
            i < STEP_DOTS.length - 1 ? "flex flex-1 items-center" : "flex"
          }
        >
          <motion.span
            title={label}
            className="flex h-3 w-3 shrink-0 rounded-full bg-gradient-to-br from-[color:var(--mint-300)] to-[color:var(--lavender-400)]"
            variants={{
              hidden: { scale: 0, opacity: 0 },
              visible: {
                scale: 1,
                opacity: 1,
                transition: { delay: 0.35 + i * 0.16, duration: 0.25 },
              },
            }}
          />
          {i < STEP_DOTS.length - 1 && (
            <span className="mx-1 h-[2px] flex-1 overflow-hidden rounded-full bg-[color:var(--lavender-300)]/25">
              <motion.span
                className="block h-full origin-left rounded-full bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)]"
                variants={{
                  hidden: { scaleX: 0 },
                  visible: {
                    scaleX: 1,
                    transition: {
                      delay: 0.42 + i * 0.16,
                      duration: 0.18,
                      ease: "easeOut",
                    },
                  },
                }}
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ModeSwitchDemo() {
  return (
    <div className="relative flex h-9 w-full max-w-[220px] items-center rounded-[var(--radius-pill)] border border-[color:var(--border-soft)] bg-white/45 p-1">
      <motion.span
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[var(--radius-pill)] bg-white/90"
        variants={{
          hidden: { x: "0%" },
          visible: {
            x: ["0%", "0%", "100%", "100%", "0%"],
            transition: {
              delay: 0.5,
              duration: 2.4,
              times: [0, 0.15, 0.35, 0.75, 1],
              ease: "easeInOut",
            },
          },
        }}
      />
      <span className="relative z-10 flex-1 text-center font-medium text-[color:var(--color-ink)] text-[var(--text-2xs)]">
        Guided
      </span>
      <span className="relative z-10 flex-1 text-center font-medium text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]">
        Chat
      </span>
    </div>
  );
}
