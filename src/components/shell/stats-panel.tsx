"use client";

import { useEffect, useId } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

import {
  easeOutCurve,
  fadeUp,
  springSnappy,
  staggerContainer,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

export type StatsData = {
  currentStreak: number;
  completedSessions: number;
  totalMinutes: number;
  hintsUsed: number;
  avgConfidenceDelta: number | null;
  recentDeltas: number[];
  weekActivity: boolean[];
};

const eyebrowClass =
  "text-[var(--text-2xs)] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]";

const bigNumberClass =
  "text-[var(--text-xl)] font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] tabular-nums";

export function StatsPanel({
  stats,
  variant = "panel",
  className,
}: {
  stats: StatsData;
  variant?: "panel" | "row";
  className?: string;
}) {
  const isRow = variant === "row";
  const cardClass = cn(
    "glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-[var(--space-5)]",
    isRow && "w-[240px] shrink-0 snap-start",
  );

  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="visible"
      aria-label="Your practice"
      className={cn(
        isRow
          ? "hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
          : "flex flex-col gap-4",
        className,
      )}
    >
      {!isRow && (
        <motion.div variants={fadeUp} className={eyebrowClass}>
          Your practice
        </motion.div>
      )}

      <motion.section variants={fadeUp} className={cardClass}>
        <span className={eyebrowClass}>Streak</span>
        <div className="flex items-baseline gap-1.5">
          <CountUp value={stats.currentStreak} className={bigNumberClass} />
          <span className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
            {stats.currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
        <WeekDots days={stats.weekActivity} />
        <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          Last 7 days
        </span>
      </motion.section>

      <motion.section variants={fadeUp} className={cardClass}>
        <span className={eyebrowClass}>Totals</span>
        <dl className="flex flex-col gap-2">
          <TotalRow
            label="Sessions completed"
            value={stats.completedSessions}
          />
          <TotalRow label="Minutes practiced" value={stats.totalMinutes} />
          <TotalRow label="Hints used" value={stats.hintsUsed} />
        </dl>
      </motion.section>

      <motion.section variants={fadeUp} className={cardClass}>
        <span className={eyebrowClass}>Confidence</span>
        {stats.avgConfidenceDelta !== null ? (
          <div className="flex items-baseline gap-1.5">
            <CountUp
              value={stats.avgConfidenceDelta}
              format={formatDelta}
              className={bigNumberClass}
            />
            <span className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
              avg change
            </span>
          </div>
        ) : (
          <p className="leading-relaxed text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
            Rate your confidence at the start and end of a session to see your
            trend here.
          </p>
        )}
        {stats.recentDeltas.length >= 2 && (
          <>
            <Sparkline deltas={stats.recentDeltas} />
            <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
              Last {stats.recentDeltas.length} completed sessions
            </span>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}

function formatDelta(v: number): string {
  const fixed = v.toFixed(1);
  return v >= 0 ? `+${fixed}` : fixed;
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
        {label}
      </dt>
      <dd className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)] tabular-nums">
        <CountUp value={value} />
      </dd>
    </div>
  );
}

function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toString(),
  );

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.8,
      ease: easeOutCurve,
    });
    return () => controls.stop();
  }, [mv, value]);

  return <motion.span className={className}>{text}</motion.span>;
}

function WeekDots({ days }: { days: boolean[] }) {
  const activeCount = days.filter(Boolean).length;
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">
        Completed a session on {activeCount} of the last 7 days.
      </span>
      {days.map((active, i) => {
        const isToday = i === days.length - 1;
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springSnappy, delay: 0.15 + i * 0.06 }}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              active
                ? "bg-[color:var(--mint-500)]"
                : "border border-[color:var(--border-ink)] bg-white/45",
              isToday && "ring-2 ring-[color:var(--mint-500)]/35",
            )}
          />
        );
      })}
    </div>
  );
}

function Sparkline({ deltas }: { deltas: number[] }) {
  const rawId = useId();
  const gradientId = `spark-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const w = 200;
  const h = 56;
  const pad = 6;
  const min = Math.min(...deltas, 0);
  const max = Math.max(...deltas, 0);
  const range = max - min || 1;

  const points = deltas.map((d, i) => {
    const x = pad + (i * (w - pad * 2)) / (deltas.length - 1);
    const y = h - pad - ((d - min) / range) * (h - pad * 2);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const line = points.map((p) => p.join(",")).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${first[0]},${h - pad} ${line} ${last[0]},${h - pad}`;
  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={`Confidence change across the last ${deltas.length} sessions, from ${formatDelta(deltas[0])} to ${formatDelta(deltas[deltas.length - 1])}.`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mint-300)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--mint-300)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={pad}
        y1={zeroY}
        x2={w - pad}
        y2={zeroY}
        stroke="var(--border-ink)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />

      <motion.polygon
        points={area}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.55 }}
      />

      <motion.polyline
        points={line}
        fill="none"
        stroke="var(--mint-500)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: easeOutCurve }}
      />

      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r="3"
        fill="var(--mint-500)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.7 }}
      />
    </svg>
  );
}
