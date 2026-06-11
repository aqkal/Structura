import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/forgot-password");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <AuthCard>
        <div className="mb-6">
          <div className="leading-tight font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
            Set a new password
          </div>
          <p className="mt-2 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
            For {user.email}. Choose something you can remember.
          </p>
        </div>
        <ResetPasswordForm />
      </AuthCard>
    </main>
  );
}
