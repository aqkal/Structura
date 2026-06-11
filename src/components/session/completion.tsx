"use client";

import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";

import { LinkButton } from "@/components/ui/button";
import { Confetti } from "@/components/session/confetti";
import { RetrospectiveForm } from "@/components/session/retrospective-form";
import { formatDuration } from "@/components/session/session-panel";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

function CountUp({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value]);
  const rounded = Math.round(display);
  return <>{format ? format(rounded) : String(rounded)}</>;
}

function Stat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] bg-white/40 p-4">
      <div className="font-semibold text-[color:var(--color-ink)] text-[var(--text-xl)]">
        <CountUp value={value} format={format} />
      </div>
      <div className="tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
        {label}
      </div>
    </div>
  );
}

function MiniTrack({ label, rating }: { label: string; rating: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-right text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.span
            key={n}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + n * 0.05, duration: 0.2 }}
            className={cn(
              "h-2 w-2 rounded-full",
              n <= rating
                ? "bg-gradient-to-br from-[color:var(--mint-300)] to-[color:var(--lavender-400)]"
                : "bg-[color:var(--lavender-300)]/25",
            )}
          />
        ))}
      </div>
      <span className="font-semibold text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]">
        {rating}/5
      </span>
    </div>
  );
}

function deltaCopy(start?: number, end?: number): string {
  if (start === undefined || end === undefined) {
    return "You worked through it.";
  }
  const delta = end - start;
  if (delta >= 2)
    return `Confidence up ${delta} points. That is the whole point.`;
  if (delta === 1) return "A little more solid than when you started.";
  return "Still shaky is honest. This one is worth a second pass tomorrow.";
}

export function Completion({
  sessionId,
  elapsedSeconds,
  hintsUsed,
  rewrites,
  confidenceStart,
  confidenceEnd,
  deepSession,
}: {
  sessionId: string;
  elapsedSeconds: number;
  hintsUsed: number;
  rewrites: number;
  confidenceStart?: number;
  confidenceEnd?: number;
  deepSession: boolean;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      animate="visible"
      className="glass relative mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 overflow-hidden rounded-[var(--radius-lg)] p-8 text-center"
    >
      <Confetti />

      <motion.div
        variants={fadeUp}
        className="flex flex-col items-center gap-3"
      >
        {deepSession && (
          <span
            title="You stayed with one problem for 45 minutes or more"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-[color:var(--lavender-200)] to-[color:var(--lavender-300)] px-3 py-1 font-semibold text-[color:var(--lavender-800)] text-[var(--text-2xs)]"
          >
            Deep session
          </span>
        )}
        <h2 className="text-hero-gradient font-semibold tracking-[-0.02em] text-[var(--text-2xl)]">
          {deltaCopy(confidenceStart, confidenceEnd)}
        </h2>
      </motion.div>

      <motion.div variants={fadeUp} className="grid w-full grid-cols-3 gap-3">
        <Stat label="Time" value={elapsedSeconds} format={formatDuration} />
        <Stat label="Hints" value={hintsUsed} />
        <Stat label="Rewrites" value={rewrites} />
      </motion.div>

      {confidenceStart !== undefined && confidenceEnd !== undefined && (
        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center gap-2"
        >
          <MiniTrack label="Before" rating={confidenceStart} />
          <MiniTrack label="After" rating={confidenceEnd} />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="w-full">
        <RetrospectiveForm sessionId={sessionId} />
      </motion.div>

      <motion.p
        variants={fadeUp}
        className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]"
      >
        This session is saved to your record.
      </motion.p>

      <motion.div
        variants={fadeUp}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <LinkButton href="/session/new">Start another problem</LinkButton>
        <LinkButton href="/" variant="secondary">
          Back to dashboard
        </LinkButton>
      </motion.div>
    </motion.div>
  );
}
