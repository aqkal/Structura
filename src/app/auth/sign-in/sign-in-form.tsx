"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AuthError } from "@/components/auth/auth-alert";
import { GoogleMark } from "@/components/auth/google-mark";
import { ModeCrossfade } from "@/components/auth/mode-crossfade";
import { OtpInput } from "@/components/auth/otp-input";
import { ResendCode } from "@/components/auth/resend-code";
import { authInputClass } from "@/components/auth/styles";
import { Button } from "@/components/ui/button";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "code";
type CodeStep = "enter-email" | "enter-code";

const CODE_LENGTH = 8;

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("password");
  const [codeStep, setCodeStep] = useState<CodeStep>("enter-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const callbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function fail(message: string) {
    setError(friendlyAuthError(message));
    setAttempt((a) => a + 1);
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) fail(error.message);
  }

  async function signInWithPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        fail(error.message);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    });
  }

  async function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        fail(error.message);
        return;
      }
      setCodeStep("enter-code");
    });
  }

  async function resendCode(): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      fail(error.message);
      return false;
    }
    setError(null);
    setCode("");
    return true;
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        fail(error.message);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    });
  }

  function switchMode(nextMode: Mode) {
    setError(null);
    setMode(nextMode);
    setCodeStep("enter-email");
    setCode("");
    setPassword("");
  }

  const panelKey = mode === "password" ? "password" : `code-${codeStep}`;

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={signInWithGoogle}
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

      <ModeCrossfade modeKey={panelKey}>
        {mode === "password" && (
          <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
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
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
            />
            <Button
              type="submit"
              size="md"
              loading={isPending}
              disabled={!email || !password}
              className="mt-1 w-full"
            >
              {isPending ? "Signing in" : "Sign in"}
            </Button>
            <div className="mt-1 flex items-center justify-between text-[var(--text-xs)]">
              <button
                type="button"
                onClick={() => switchMode("code")}
                className="text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink-muted)]"
              >
                Email me a code instead
              </button>
              <Link
                href="/auth/forgot-password"
                className="text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink-muted)]"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        )}

        {mode === "code" && codeStep === "enter-email" && (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
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
              {isPending ? "Sending code" : "Email me an 8 digit code"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className="mt-1 self-start text-[color:var(--color-ink-subtle)] text-[var(--text-xs)] hover:text-[color:var(--color-ink-muted)]"
            >
              Use password instead
            </button>
          </form>
        )}

        {mode === "code" && codeStep === "enter-code" && (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <div className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
              We sent an 8 digit code to{" "}
              <span className="font-medium text-[color:var(--color-ink)]">
                {email}
              </span>
              .
            </div>
            <label
              htmlFor="code"
              className="mt-1 font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)]"
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
            <div className="mt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setCodeStep("enter-email");
                  setCode("");
                  setError(null);
                }}
                className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)] hover:text-[color:var(--color-ink-muted)]"
              >
                Use a different email
              </button>
              <ResendCode onResend={resendCode} />
            </div>
          </form>
        )}
      </ModeCrossfade>

      <AuthError message={error} attempt={attempt} />

      <div className="mt-2 text-center text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
        New here?{" "}
        <Link
          href={`/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)]"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
