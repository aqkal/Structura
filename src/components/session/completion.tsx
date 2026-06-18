"use client";

import { motion } from "framer-motion";

import { LinkButton } from "@/components/ui/button";
import { Confetti } from "@/components/session/confetti";
import { formatDuration } from "@/components/session/session-panel";
import { ProofCard } from "@/components/session/proof-card";
import type { ProofSummary } from "@/lib/server/ai/guided";
import { fadeUp, staggerContainer } from "@/lib/motion";

export function Completion({
  sessionId,
  topic,
  summary,
  elapsedSeconds,
  movesAnswered,
  pasted,
}: {
  sessionId: string;
  topic: string;
  summary: ProofSummary;
  elapsedSeconds: number;
  movesAnswered: number;
  pasted: boolean;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="visible"
      className="relative flex flex-col items-center gap-6"
    >
      <Confetti />

      <motion.div
        variants={fadeUp}
        className="flex flex-col items-center gap-1 text-center"
      >
        <h2 className="text-hero-gradient font-semibold tracking-[-0.02em] text-[var(--text-2xl)]">
          You reasoned it through.
        </h2>
        <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
          {movesAnswered} responses &middot; {formatDuration(elapsedSeconds)}{" "}
          &middot; saved to your portfolio
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="w-full">
        <ProofCard topic={topic} summary={summary} pasted={pasted} />
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <LinkButton href="/portfolio">View portfolio</LinkButton>
        <LinkButton href={`/proof/${sessionId}`} variant="secondary">
          Download as PDF
        </LinkButton>
        <LinkButton href="/session/new" variant="ghost">
          Start another
        </LinkButton>
      </motion.div>
    </motion.div>
  );
}
