"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";

import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Pop = { start: number; end: number; token: number };

export function OtpInput({
  value,
  onChange,
  length = 8,
  id = "code",
  name = "code",
  required = false,
  autoFocus = false,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [pop, setPop] = useState<Pop | null>(null);

  const activeIndex = Math.min(value.length, length - 1);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/\D/g, "").slice(0, length);
    if (next.length > value.length) {
      setPop((prev) => ({
        start: value.length,
        end: next.length,
        token: (prev?.token ?? 0) + 1,
      }));
    }
    onChange(next);
  }

  function pinCaret() {
    const el = inputRef.current;
    if (!el) return;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end);
    }
  }

  return (
    <div className="relative">
      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? "";
          const isActive = focused && i === activeIndex && !disabled;

          let charKey = `char-${i}`;
          let charInitial: false | { scale: number; opacity: number } = false;
          let charDelay = 0;
          if (pop !== null && i >= pop.start && i < pop.end) {
            charKey = `pop-${pop.token}-${i}`;
            charInitial = { scale: 0.5, opacity: 0 };
            if (pop.end - pop.start > 1) {
              charDelay = (i - pop.start) * 0.045;
            }
          }

          return (
            <motion.div
              key={i}
              initial={false}
              animate={{ scale: isActive ? 1.04 : 1 }}
              transition={springSnappy}
              className={cn(
                "flex h-11 w-full max-w-9 flex-1 items-center justify-center",
                "rounded-sm border bg-white/75 font-mono text-[16px]",
                "text-[color:var(--color-ink)] transition-colors duration-150",
                isActive
                  ? "border-[color:var(--lavender-400)] bg-white ring-2 ring-[color:var(--lavender-400)]/40"
                  : "border-[color:var(--border-soft)]",
              )}
            >
              {char ? (
                <motion.span
                  key={charKey}
                  initial={charInitial}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...springSnappy, delay: charDelay }}
                >
                  {char}
                </motion.span>
              ) : isActive ? (
                <span className="stream-caret" />
              ) : null}
            </motion.div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`[0-9]{${length}}`}
        maxLength={length}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={pinCaret}
        className="absolute inset-0 h-full w-full cursor-text text-[16px] opacity-0"
        style={{ caretColor: "transparent", color: "transparent" }}
      />
    </div>
  );
}
