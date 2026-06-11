"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CHAT_MODELS, type ChatModelId } from "@/lib/chat-models";
import { scaleIn, springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ModelSelectProps = {
  value: ChatModelId;
  onChange: (id: ChatModelId) => void;
  direction?: "up" | "down";
};

export function ModelSelect({
  value,
  onChange,
  direction = "up",
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const listboxId = useId();

  const active = CHAT_MODELS.find((m) => m.id === value) ?? CHAT_MODELS[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function choose(id: ChatModelId) {
    onChange(id);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 220);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${active.label}`}
        className={cn(
          "glass-soft inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] px-3",
          "font-medium text-[color:var(--color-ink-muted)] text-[var(--text-2xs)]",
          "transition-colors hover:text-[color:var(--color-ink)]",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={active.id}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.12 }}
            className="max-w-[10rem] truncate"
          >
            {active.label}
          </motion.span>
        </AnimatePresence>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listboxId}
            role="listbox"
            aria-label="Choose a model"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            style={{ originY: direction === "up" ? 1 : 0, originX: 0 }}
            className={cn(
              "glass absolute left-0 z-20 w-64 overflow-hidden",
              direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
              "rounded-[var(--radius-md)] p-1",
            )}
          >
            {CHAT_MODELS.map((m) => {
              const selected = m.id === value;
              return (
                <li key={m.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(m.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left",
                      "transition-colors hover:bg-white/50",
                      selected && "bg-white/40",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[color:var(--mint-700)]"
                    >
                      {selected ? (
                        <motion.svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          initial={{ scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={springSnappy}
                        >
                          <path
                            d="M2.5 6.5L4.75 8.75L9.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      ) : null}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="leading-tight font-medium text-[color:var(--color-ink)] text-[var(--text-sm)]">
                        {m.label}
                      </span>
                      <span className="leading-tight text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                        {m.blurb}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
