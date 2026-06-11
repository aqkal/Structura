"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ResendCode({
  onResend,
  initialSeconds = 30,
  className,
}: {
  onResend: () => Promise<boolean>;
  initialSeconds?: number;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function resend() {
    if (busy) return;
    setBusy(true);
    try {
      const sent = await onResend();
      if (sent) {
        setJustSent(true);
        setSeconds(initialSeconds);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]",
        className,
      )}
    >
      {seconds > 0 ? (
        <span>
          {justSent && <span role="status">New code sent. </span>}
          Resend code in {seconds}s
        </span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className={cn(
            "-my-3 py-3 font-medium text-[color:var(--color-ink-muted)]",
            "hover:text-[color:var(--color-ink)] disabled:opacity-60",
          )}
        >
          {busy ? "Sending code" : "Resend code"}
        </button>
      )}
    </div>
  );
}
