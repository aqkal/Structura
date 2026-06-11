"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { AuthError, AuthStatus } from "@/components/auth/auth-alert";
import { ModeCrossfade } from "@/components/auth/mode-crossfade";
import { authInputClass } from "@/components/auth/styles";
import { Button } from "@/components/ui/button";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);

  const callbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/auth/callback?next=/auth/reset-password`;

  function fail(message: string) {
    setError(friendlyAuthError(message));
    setAttempt((a) => a + 1);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: callbackUrl,
        },
      );
      if (error) {
        fail(error.message);
        return;
      }
      setSent(true);
    });
  }

  return (
    <ModeCrossfade modeKey={sent ? "sent" : "form"}>
      {sent ? (
        <div className="flex flex-col gap-3">
          <AuthStatus>
            If an account exists for{" "}
            <span className="font-medium">{email}</span>, we&apos;ve sent a
            reset link. Check your inbox.
          </AuthStatus>
          <Link
            href="/auth/sign-in"
            className="mt-1 self-start text-[color:var(--color-ink-subtle)] text-[var(--text-xs)] hover:text-[color:var(--color-ink-muted)]"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label
              htmlFor="email"
              className="font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
            />
            <Button
              type="submit"
              size="md"
              loading={isPending}
              disabled={!email}
              className="mt-1 w-full"
            >
              {isPending ? "Sending link" : "Send reset link"}
            </Button>
          </form>

          <AuthError message={error} attempt={attempt} />

          <div className="text-center text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
            <Link
              href="/auth/sign-in"
              className="font-medium text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      )}
    </ModeCrossfade>
  );
}
