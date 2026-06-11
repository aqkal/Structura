import { cn } from "@/lib/utils";

export const authInputClass = cn(
  "h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--border-soft)]",
  "bg-white/75 px-4 text-[16px] text-[color:var(--color-ink)]",
  "transition-[background-color,box-shadow] duration-150",
  "placeholder:text-[color:var(--color-ink-subtle)]",
  "focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-400)]/60",
);
