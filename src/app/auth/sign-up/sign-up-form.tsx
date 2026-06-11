"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AuthError, AuthStatus } from "@/components/auth/auth-alert";
import { GoogleMark } from "@/components/auth/google-mark";
import { ModeCrossfade } from "@/components/auth/mode-crossfade";
import { OtpInput } from "@/components/auth/otp-input";
import {
  PasswordChecklist,
  PasswordMatchHint,
  PasswordStrength,
} from "@/components/auth/password-strength";
import { ResendCode } from "@/components/auth/resend-code";
import { authInputClass } from "@/components/auth/styles";
import { Button } from "@/components/ui/button";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

const CODE_LENGTH = 8;

export function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [checkInbox, setCheckInbox] = useState(false);
  const [code, setCode] = useState("");

  const callbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function fail(message: string) {
    setError(friendlyAuthError(message));
    setAttempt((a) => a + 1);
  }

  function clientValidate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const v = clientValidate();
    if (v) {
      fail(v);
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) {
        fail(error.message);
        return;
      }
      if (data.session) {
        router.push(next ?? "/");
        router.refresh();
      } else {
        setError(null);
        setCheckInbox(true);
      }
    });
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "signup",
      });
      if (error) {
        fail(error.message);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    });
  }

  async function resendCode(): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) {
      fail(error.message);
      return false;
    }
    setError(null);
    setCode("");
    return true;
  }

  async function signUpWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) fail(error.message);
  }

  return (
    <ModeCrossfade modeKey={checkInbox ? "verify" : "form"}>
      {checkInbox ? (
        <div className="flex flex-col gap-4">
          <AuthStatus>
            We sent an 8 digit code to{" "}
            <span className="font-medium">{email}</span>. Paste it below, or
            click the link in the email.
          </AuthStatus>

          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <label
              htmlFor="code"
              className="font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
            >
              8 digit code
            </label>
            <OtpInput
              value={code}
              onChange={setCode}
              length={CODE_LENGTH}
              id="code"
              name="code"
              required
              autoFocus
            />
            <Button
              type="submit"
              size="md"
              loading={isPending}
              disabled={code.length !== CODE_LENGTH}
              className="mt-1 w-full"
            >
              {isPending ? "Verifying" : "Verify and sign in"}
            </Button>
            <ResendCode onResend={resendCode} className="mt-1" />
          </form>

          <AuthError message={error} attempt={attempt} />

          <Link
            href="/auth/sign-in"
            className="self-start text-[color:var(--color-ink-subtle)] text-[var(--text-xs)] hover:text-[color:var(--color-ink-muted)]"
          >
            Already confirmed? Sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={signUpWithGoogle}
            className="w-full"
          >
            <GoogleMark />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
            <div className="h-px flex-1 bg-[color:var(--border-soft)]" />
            or
            <div className="h-px flex-1 bg-[color:var(--border-soft)]" />
          </div>

          <form onSubmit={signUp} className="flex flex-col gap-3">
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
            <label
              htmlFor="password"
              className="mt-1 font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
            >
              Password
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
              Confirm password
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
              disabled={!email || password.length < 8 || password !== confirm}
              className="mt-1 w-full"
            >
              {isPending ? "Creating account" : "Create account"}
            </Button>
          </form>

          <AuthError message={error} attempt={attempt} />

          <div className="mt-2 text-center text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
            Already have an account?{" "}
            <Link
              href={`/auth/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </ModeCrossfade>
  );
}
