import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { getCurrentUser } from "@/lib/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <AuthCard>
        <div className="mb-6">
          <div className="leading-tight font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
            Reset your password
          </div>
          <p className="mt-2 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
            Enter the email associated with your account. We&apos;ll send a link
            to set a new password.
          </p>
        </div>
        <ForgotPasswordForm />
      </AuthCard>
    </main>
  );
}
