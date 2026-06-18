import { notFound, redirect } from "next/navigation";

import { ProofCard } from "@/components/session/proof-card";
import { getCurrentUser } from "@/lib/auth";
import type { ProofSummary } from "@/lib/server/ai/guided";
import { getGuidedState } from "@/lib/server/sessions";

import { PrintControls } from "./print-controls";

export const metadata = { title: "Reasoning proof" };

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/sign-in?next=/proof/${id}`);

  const state = await getGuidedState(id, user.id);
  if (!state || state.session.status !== "completed") notFound();

  const summary = (state.session.summary as ProofSummary | null) ?? null;
  if (!summary) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col gap-5 px-5 py-10">
      <PrintControls />
      <ProofCard
        topic={state.session.problemText}
        summary={summary}
        pasted={state.session.pasted}
      />
      <p
        data-no-print
        className="text-center text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]"
      >
        Tip: in the print dialog, choose &ldquo;Save as PDF&rdquo; as the
        destination.
      </p>
    </main>
  );
}
