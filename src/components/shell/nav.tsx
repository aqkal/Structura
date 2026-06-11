"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { scaleIn } from "@/lib/motion";
import { useIsMac } from "@/lib/hooks/use-shortcuts";
import { ModeSwitch } from "./mode-switch";
import { useShell } from "./shell-provider";

type NavUser = { name: string | null; email: string };

type NavProps = {
  user: NavUser | null;
};

export function Nav({ user }: NavProps) {
  const { setDrawerOpen, setPaletteOpen, hasSidebar } = useShell();
  const mac = useIsMac();

  return (
    <nav
      className={cn(
        "sticky top-0 z-50",
        "flex items-center justify-between",
        "px-4 py-3.5 sm:px-6",
        "glass-soft border-b",
      )}
    >
      <div className="flex items-center gap-1">
        {user && hasSidebar && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] transition-colors hover:bg-white/40 hover:text-[color:var(--color-ink)] lg:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 5h12M3 9h12M3 13h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        <Link
          href="/"
          className="font-sans font-semibold tracking-tight text-[color:var(--mint-900)] text-[var(--text-lg)]"
        >
          Structura
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden sm:block">
              <ModeSwitch />
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden h-8 items-center gap-1 rounded-full px-2 text-[color:var(--color-ink-subtle)] transition-colors hover:bg-white/40 hover:text-[color:var(--color-ink)] md:[@media(hover:hover)]:inline-flex"
            >
              <kbd>{mac ? "⌘" : "Ctrl"}</kbd>
              <kbd>K</kbd>
            </button>

            <AvatarMenu user={user} />
          </>
        ) : (
          <LinkButton href="/auth/sign-in" size="sm">
            Sign in
          </LinkButton>
        )}
      </div>
    </nav>
  );
}

const menuItemClass = cn(
  "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5",
  "text-left font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]",
  "transition-colors hover:bg-white/60 hover:text-[color:var(--color-ink)]",
  "focus-visible:bg-white/60 focus-visible:text-[color:var(--color-ink)]",
);

function AvatarMenu({ user }: { user: NavUser }) {
  const { setShortcutsOpen } = useShell();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const delta = e.key === "ArrowDown" ? 1 : -1;
    const next = (current + delta + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-[#0d3320] text-[var(--text-sm)]"
          style={{
            background:
              "linear-gradient(135deg, var(--mint-300), var(--lavender-400))",
          }}
        >
          {initial}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Account"
            className="glass absolute right-0 z-[60] mt-2 w-60 origin-top-right rounded-[var(--radius)] p-1.5"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onKeyDown={onMenuKeyDown}
          >
            <div className="px-3 pt-2 pb-2.5">
              <p className="truncate font-semibold text-[color:var(--color-ink)] text-[var(--text-xs)]">
                {user.name ?? user.email}
              </p>
              {user.name && (
                <p className="truncate text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                  {user.email}
                </p>
              )}
            </div>
            <div
              className="mx-1.5 mb-1 border-t border-[color:var(--border-ink)]"
              aria-hidden="true"
            />

            <Link
              href="/settings"
              role="menuitem"
              className={menuItemClass}
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>

            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                setShortcutsOpen(true);
              }}
            >
              Keyboard shortcuts
            </button>

            <div className="px-3 py-2">
              <ThemeToggle compact className="w-full" />
            </div>

            <form action="/auth/sign-out" method="post">
              <button type="submit" role="menuitem" className={menuItemClass}>
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
