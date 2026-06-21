"use client";

import { CHAT_MODELS, type ChatModelId } from "@/lib/chat-models";
import { cn } from "@/lib/utils";

type ModelSelectProps = {
  value: ChatModelId;
  onChange?: (id: ChatModelId) => void;
  direction?: "up" | "down";
};

export function ModelSelect({ value }: ModelSelectProps) {
  const active = CHAT_MODELS.find((m) => m.id === value) ?? CHAT_MODELS[0];

  return (
    <span
      title="Disabled for beta release"
      aria-disabled="true"
      className={cn(
        "glass-soft inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-[var(--radius-pill)] px-3",
        "font-medium text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] opacity-60",
      )}
    >
      <span className="max-w-[10rem] truncate">{active.label}</span>
    </span>
  );
}
