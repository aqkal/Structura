import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { getCurrentUser } from "@/lib/auth";
import { friendlyAuthError } from "@/lib/auth-errors";
import { SignUpForm } from "./sign-up-form";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const { next, error } = await searchParams;

  if (user) redirect(next ?? "/");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <AuthCard>
        <div className="mb-6">
          <div className="leading-tight font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
            Create your account
          </div>
          <p className="mt-2 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
            Join Structura. You&apos;ll get your own private record of how you
            think, not just what you got right.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--lavender-400)] bg-[color:var(--lavender-200)]/60 px-4 py-3 text-[color:var(--lavender-800)] text-[var(--text-sm)]"
          >
            {friendlyAuthError(decodeURIComponent(error))}
          </div>
        )}

        <SignUpForm next={next} />
      </AuthCard>
    </main>
  );
}
