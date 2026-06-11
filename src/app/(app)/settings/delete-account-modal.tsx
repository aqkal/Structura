"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { fade, scaleIn } from "@/lib/motion";

const CONFIRM_WORD = "delete";

type DeleteAccountModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open]);

  function close() {
    if (deleting) return;
    setTyped("");
    setError(null);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;

    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function confirmDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ??
            "Deletion did not finish. You can safely try again.",
        );
      }

      window.location.assign("/");
    } catch (err) {
      setDeleting(false);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Deletion did not finish. You can safely try again.",
      );
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onKeyDown={onKeyDown}
          role="presentation"
        >
          <motion.div
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={close}
            aria-hidden="true"
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-desc"
            className="glass relative flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] bg-white/90 p-[var(--space-6)] shadow-[var(--shadow-card)]"
            style={{ borderColor: "var(--lavender-300)" }}
          >
            <h2
              id="delete-account-title"
              className="font-semibold tracking-[-0.01em] text-[color:var(--color-ink)] text-[var(--text-lg)]"
            >
              Delete your account?
            </h2>

            <div
              id="delete-account-desc"
              className="flex flex-col gap-3 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]"
            >
              <p>This permanently removes:</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>
                  Every guided session, with its steps, hints, and reflections
                </li>
                <li>Every chat, every message, and every uploaded file</li>
                <li>Your profile, confidence ratings, and usage history</li>
              </ul>
              <p>
                Deletion is immediate. There is no grace period and no way to
                recover anything afterward.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="delete-account-confirm"
                  className="font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
                >
                  Type{" "}
                  <span className="font-semibold text-[color:var(--lavender-800)]">
                    delete
                  </span>{" "}
                  to confirm
                </label>
                <input
                  ref={inputRef}
                  id="delete-account-confirm"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={deleting}
                  placeholder="delete"
                  className="h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/75 px-4 text-[16px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-subtle)] focus:bg-white focus:ring-2 focus:ring-[color:var(--lavender-400)]/60 focus:outline-none"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-[color:var(--lavender-300)] bg-[color:var(--lavender-100)]/80 px-4 py-3 text-[color:var(--lavender-800)] text-[var(--text-xs)]"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="subtle"
                  loading={deleting}
                  disabled={!confirmed}
                >
                  Delete account and all data
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
