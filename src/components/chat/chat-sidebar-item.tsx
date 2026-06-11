"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { durations, easeOutCurve, springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ChatSidebarItemProps = {
  id: string;
  title: string;
  active: boolean;
  onDelete: (id: string) => void;
};

type Menu = "closed" | "open" | "renaming";

export function ChatSidebarItem({
  id,
  title,
  active,
  onDelete,
}: ChatSidebarItemProps) {
  const router = useRouter();
  const [menu, setMenu] = useState<Menu>("closed");
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameInFlight = useRef(false);

  useEffect(() => {
    if (menu === "renaming") {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [menu]);

  useEffect(() => {
    if (menu !== "renaming") {
      const t = setTimeout(() => setDraft(title), 0);
      return () => clearTimeout(t);
    }
  }, [title, menu]);

  async function commitRename() {
    if (renameInFlight.current) return;
    const next = draft.trim();
    if (next.length === 0 || next === title) {
      setMenu("closed");
      setDraft(title);
      return;
    }
    renameInFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not rename the chat.");
      }
      setMenu("closed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setDraft(title);
      setMenu("closed");
    } finally {
      renameInFlight.current = false;
      setBusy(false);
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(title);
      setMenu("closed");
    }
  }

  if (menu === "renaming") {
    return (
      <div className="px-2 py-1.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={() => void commitRename()}
          disabled={busy}
          aria-label="Rename chat"
          maxLength={80}
          className="w-full rounded-[var(--radius-sm)] border border-[color:var(--lavender-400)] bg-white/90 px-2 py-1 text-[color:var(--color-ink)] text-[var(--text-xs)] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center rounded-[var(--radius-sm)] transition-colors hover:bg-[color:var(--surface-2)]">
      {active && (
        <motion.span
          layoutId="chat-active-pill"
          transition={springSoft}
          aria-hidden="true"
          className="absolute inset-0 rounded-[var(--radius-sm)] bg-[color:var(--surface-1)] ring-1 ring-[color:var(--lavender-300)]"
        />
      )}

      <Link
        href={`/chat/${id}`}
        className={cn(
          "relative z-10 min-w-0 flex-1 px-2 py-2 text-[var(--text-xs)]",
          active
            ? "font-medium text-[color:var(--color-ink)]"
            : "text-[color:var(--color-ink-muted)]",
        )}
      >
        <AnimatedTitle title={title} />
      </Link>

      {menu === "open" ? (
        <div className="relative z-10 flex items-center gap-0.5 pr-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu("renaming");
            }}
            className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[color:var(--color-ink-muted)] text-[var(--text-2xs)] hover:bg-[color:var(--surface-2)]"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu("closed");
              onDelete(id);
            }}
            className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[color:var(--color-ink-muted)] text-[var(--text-2xs)] hover:bg-[color:var(--surface-2)]"
          >
            Delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu("open");
          }}
          aria-label="Chat options"
          className={cn(
            "relative z-10 mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-ink-subtle)] transition-opacity hover:bg-[color:var(--surface-2)] hover:text-[color:var(--color-ink)]",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "[@media(hover:none)]:opacity-100",
            active && "opacity-100",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="3" cy="7" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7" r="1.2" fill="currentColor" />
            <circle cx="11" cy="7" r="1.2" fill="currentColor" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AnimatedTitle({ title }: { title: string }) {
  return (
    <span className="relative block min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={title}
          initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
          animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
          exit={{
            opacity: 0,
            filter: "blur(3px)",
            transition: { duration: 0.2 },
          }}
          transition={{ duration: durations.slow, ease: easeOutCurve }}
          className="block truncate"
        >
          {title}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
