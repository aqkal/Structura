"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { durations, springSoft } from "@/lib/motion";
import { useShell } from "./shell-provider";

export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const { drawerOpen, setDrawerOpen } = useShell();
  const pathname = usePathname() ?? "";
  const panelRef = React.useRef<HTMLElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDrawerOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname, setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  React.useEffect(() => {
    if (drawerOpen) {
      lastFocused.current =
        (document.activeElement as HTMLElement | null) ?? null;
      const t = setTimeout(() => panelRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [drawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="glass absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto overscroll-contain rounded-r-[var(--radius-lg)] p-[var(--space-5)] outline-none"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={springSoft}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] transition-colors hover:bg-white/40 hover:text-[color:var(--color-ink)]"
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
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
