"use client";

export function Thinking({
  label = "Qualia is reading your reasoning",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="relative h-[2px] overflow-hidden rounded bg-[color:var(--lavender-300)]/30">
        <div className="thinking-bar absolute inset-y-0 w-2/5 rounded bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)]" />
      </div>
      <div className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
        {label}
      </div>
    </div>
  );
}
