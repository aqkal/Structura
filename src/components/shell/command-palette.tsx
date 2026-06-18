"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { durations, springSnappy } from "@/lib/motion";
import { useShell } from "./shell-provider";

type SearchSession = {
  id: string;
  problem: string;
  subject: string;
  status: string;
};
type SearchChat = { id: string; title: string };
type SearchResults = { sessions: SearchSession[]; chats: SearchChat[] };

type PaletteItem = {
  key: string;
  label: string;
  group: "Actions" | "Sessions" | "Chats";
  hint?: string;
  active?: boolean;
  run: () => void;
};

const EMPTY_RESULTS: SearchResults = { sessions: [], chats: [] };

function submitSignOut() {
  const form = document.createElement("form");
  form.method = "post";
  form.action = "/auth/sign-out";
  document.body.appendChild(form);
  form.submit();
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setShortcutsOpen } = useShell();
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY_RESULTS);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);

  const close = React.useCallback(
    () => setPaletteOpen(false),
    [setPaletteOpen],
  );

  const navigate = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  React.useEffect(() => {
    if (paletteOpen) {
      lastFocused.current =
        (document.activeElement as HTMLElement | null) ?? null;
      const t = setTimeout(() => {
        setQuery("");
        setSelectedIndex(0);
        setResults(EMPTY_RESULTS);
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [paletteOpen]);

  React.useEffect(() => {
    if (!paletteOpen) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as SearchResults;
        setResults({
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          chats: Array.isArray(data.chats) ? data.chats : [],
        });
      } catch {}
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [paletteOpen, query]);

  const items = React.useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const allActions: PaletteItem[] = [
      {
        key: "action-new-chat",
        label: "New chat",
        group: "Actions",
        run: () => navigate("/chat"),
      },
      {
        key: "action-new-session",
        label: "New guided session",
        group: "Actions",
        run: () => navigate("/session/new"),
      },
      {
        key: "action-dashboard",
        label: "Dashboard",
        group: "Actions",
        run: () => navigate("/"),
      },
      {
        key: "action-settings",
        label: "Settings",
        group: "Actions",
        run: () => navigate("/settings"),
      },
      {
        key: "action-shortcuts",
        label: "Keyboard shortcuts",
        group: "Actions",
        run: () => {
          close();
          setShortcutsOpen(true);
        },
      },
      {
        key: "action-sign-out",
        label: "Sign out",
        group: "Actions",
        run: () => {
          close();
          submitSignOut();
        },
      },
    ];
    const actions = allActions.filter((a) => a.label.toLowerCase().includes(q));

    const sessions: PaletteItem[] = results.sessions.map((s) => ({
      key: `session-${s.id}`,
      label: s.problem,
      group: "Sessions",
      hint: s.subject,
      active: s.status === "active",
      run: () => navigate(`/session/${s.id}`),
    }));

    const chats: PaletteItem[] = results.chats.map((c) => ({
      key: `chat-${c.id}`,
      label: c.title,
      group: "Chats",
      run: () => navigate(`/chat/${c.id}`),
    }));

    return [...actions, ...sessions, ...chats];
  }, [query, results, navigate, close, setShortcutsOpen]);

  const sel =
    items.length === 0 ? -1 : Math.min(selectedIndex, items.length - 1);

  React.useEffect(() => {
    if (sel < 0) return;
    document
      .getElementById(`palette-item-${sel}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length > 0)
        setSelectedIndex(Math.min(sel + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length > 0) setSelectedIndex(Math.max(sel - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel >= 0) items[sel]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
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
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="glass relative flex w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-lg)]"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.97,
              transition: { duration: durations.fast },
            }}
            transition={springSnappy}
            onKeyDown={onKeyDown}
          >
            <div className="border-b border-[color:var(--border-ink)] p-3">
              <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/55 px-3.5 transition-shadow focus-within:ring-2 focus-within:ring-[color:var(--lavender-400)]/60">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--color-ink-subtle)]"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="m10.5 10.5 3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-palette-list"
                  aria-activedescendant={
                    sel >= 0 ? `palette-item-${sel}` : undefined
                  }
                  aria-autocomplete="list"
                  aria-label="Search sessions, chats, and actions"
                  placeholder="Search or jump to..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  style={{ outline: "none" }}
                  className="h-11 w-full bg-transparent text-[16px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-subtle)]"
                />
              </div>
            </div>

            <ul
              id="command-palette-list"
              role="listbox"
              aria-label="Results"
              className="max-h-[40vh] overflow-y-auto overscroll-contain p-1.5"
            >
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
                  Nothing matches. Try fewer words.
                </li>
              )}

              {items.map((item, index) => {
                const showHeader =
                  index === 0 || items[index - 1].group !== item.group;
                return (
                  <React.Fragment key={item.key}>
                    {showHeader && (
                      <li
                        role="presentation"
                        className="px-3 pt-2.5 pb-1 font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase"
                      >
                        {item.group}
                      </li>
                    )}
                    <li
                      id={`palette-item-${index}`}
                      role="option"
                      aria-selected={sel === index}
                      className="relative cursor-pointer rounded-[var(--radius-sm)]"
                      onMouseMove={() => setSelectedIndex(index)}
                      onClick={() => item.run()}
                    >
                      {sel === index && (
                        <motion.span
                          layoutId="palette-selected"
                          aria-hidden="true"
                          className="absolute inset-0 rounded-[var(--radius-sm)] bg-white/70"
                          transition={springSnappy}
                        />
                      )}
                      <span className="relative flex min-h-11 items-center gap-2.5 px-3 py-2">
                        {item.active && (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[color:var(--mint-500)]"
                          />
                        )}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[var(--text-sm)]",
                            sel === index
                              ? "text-[color:var(--color-ink)]"
                              : "text-[color:var(--color-ink-muted)]",
                          )}
                        >
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="shrink-0 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>

            <div className="flex items-center gap-3 border-t border-[color:var(--border-ink)] px-4 py-2 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
              <span className="flex items-center gap-1">
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd>↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd>esc</kbd> close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
