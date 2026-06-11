"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { durations, fadeUp, scaleIn, staggerContainer } from "@/lib/motion";
import { useIsMac } from "@/lib/hooks/use-shortcuts";
import { useShell } from "./shell-provider";

type ShortcutRow = { keys: string[]; label: string };
type ShortcutGroup = { title: string; rows: ShortcutRow[] };

function buildGroups(mod: string): ShortcutGroup[] {
  return [
    {
      title: "Global",
      rows: [
        { keys: [mod, "K"], label: "Open the command palette" },
        { keys: [mod, "/"], label: "Show keyboard shortcuts" },
        { keys: [mod, "Shift", "O"], label: "Start a new chat" },
      ],
    },
    {
      title: "Chat",
      rows: [
        { keys: ["Enter"], label: "Send your message" },
        { keys: ["Shift", "Enter"], label: "Add a new line" },
        { keys: ["Esc"], label: "Stop the response" },
      ],
    },
    {
      title: "Guided",
      rows: [
        { keys: [mod, "Enter"], label: "Submit your answer" },
        { keys: ["Esc"], label: "Stop generating" },
      ],
    },
  ];
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useShell();
  const mac = useIsMac();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);

  const close = React.useCallback(
    () => setShortcutsOpen(false),
    [setShortcutsOpen],
  );

  React.useEffect(() => {
    if (!shortcutsOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcutsOpen, close]);

  React.useEffect(() => {
    if (shortcutsOpen) {
      lastFocused.current =
        (document.activeElement as HTMLElement | null) ?? null;
      const t = setTimeout(() => panelRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [shortcutsOpen]);

  const groups = buildGroups(mac ? "⌘" : "Ctrl");

  return (
    <AnimatePresence>
      {shortcutsOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast }}
            onClick={close}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-dialog-title"
            tabIndex={-1}
            className="glass relative flex max-h-[80vh] w-full max-w-md flex-col overflow-y-auto rounded-[var(--radius-lg)] p-[var(--space-6)] outline-none"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="shortcuts-dialog-title"
                className="font-semibold text-[color:var(--mint-900)] text-[var(--text-lg)]"
              >
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mt-1 -mr-1 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] transition-colors hover:bg-white/40 hover:text-[color:var(--color-ink)]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <motion.div
              className="flex flex-col gap-5"
              variants={staggerContainer(0.04, 0.05)}
              initial="hidden"
              animate="visible"
            >
              {groups.map((group) => (
                <div key={group.title} className="flex flex-col gap-1.5">
                  <motion.h3
                    variants={fadeUp}
                    className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase"
                  >
                    {group.title}
                  </motion.h3>
                  {group.rows.map((row) => (
                    <motion.div
                      key={row.label}
                      variants={fadeUp}
                      className="flex items-center justify-between gap-4 py-1"
                    >
                      <span className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                        {row.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {row.keys.map((key, i) => (
                          <kbd key={`${row.label}-${i}`}>{key}</kbd>
                        ))}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
