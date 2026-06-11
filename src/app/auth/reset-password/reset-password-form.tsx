"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AuthError } from "@/components/auth/auth-alert";
import {
  PasswordChecklist,
  PasswordMatchHint,
  PasswordStrength,
} from "@/components/auth/password-strength";
import { authInputClass } from "@/components/auth/styles";
import { Button } from "@/components/ui/button";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  function fail(message: string) {
    setError(friendlyAuthError(message));
    setAttempt((a) => a + 1);
  }

  function clientValidate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const v = clientValidate();
    if (v) {
      fail(v);
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        fail(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label
          htmlFor="password"
          className="font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
        >
          New password
          <span className="ml-1 font-normal text-[color:var(--color-ink-subtle)]">
            (8+ characters)
          </span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          autoFocus
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        <PasswordStrength password={password} />
        <PasswordChecklist password={password} />
        <label
          htmlFor="confirm"
          className="mt-1 font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={authInputClass}
        />
        <PasswordMatchHint password={password} confirm={confirm} />
        <Button
          type="submit"
          size="md"
          loading={isPending}
          disabled={password.length < 8 || password !== confirm}
          className="mt-1 w-full"
        >
          {isPending ? "Updating" : "Update password and sign in"}
        </Button>
      </form>

      <AuthError message={error} attempt={attempt} />
    </div>
  );
}
