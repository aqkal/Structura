"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export type SidebarSession = {
  id: string;
  problemText: string;
  subjectSlug: string;
  status: string;
  timeAgo: string;
};

export function SessionSidebarItem({ session }: { session: SidebarSession }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/session/${session.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          data?.error?.message ?? "Could not delete the session.",
        );
      }
      setHidden(true);
      if (pathname === `/session/${session.id}`) {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <AnimatePresence initial={false}>
      {!hidden && (
        <motion.li
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden"
        >
          <Link
            href={`/session/${session.id}`}
            className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 pr-8 transition-colors hover:bg-[color:var(--surface-2)]"
          >
            <StatusDot status={session.status} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-[color:var(--color-ink)] text-[var(--text-xs)]">
                {session.problemText}
              </span>
              <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                {capitalize(session.subjectSlug)} · {session.timeAgo}
              </span>
            </span>
          </Link>

          <button
            type="button"
            aria-label={
              confirming
                ? `Confirm delete: ${session.problemText}`
                : `Delete session: ${session.problemText}`
            }
            disabled={deleting}
            onClick={() => {
              if (confirming) void remove();
              else {
                setConfirming(true);
                setTimeout(() => setConfirming(false), 3000);
              }
            }}
            className={cn(
              "absolute top-2 right-1.5 flex h-6 w-6 items-center justify-center rounded",
              "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
              confirming
                ? "bg-[color:var(--lavender-200)] text-[color:var(--lavender-800)] opacity-100"
                : "text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink)]",
            )}
          >
            {deleting ? (
              <Spinner />
            ) : confirming ? (
              <CheckIcon />
            ) : (
              <TrashIcon />
            )}
          </button>
        </motion.li>
      )}
    </AnimatePresence>
  );
}

function capitalize(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        status === "active" && "animate-pulse bg-[color:var(--mint-500)]",
        status === "completed" && "bg-[color:var(--mint-700)]",
        status !== "active" &&
          status !== "completed" &&
          "border border-[color:var(--lavender-300)] bg-transparent",
      )}
    />
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 3.5h9M5.5 3.5v-1h3v1M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5 5 9l4.5-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
    />
  );
}
