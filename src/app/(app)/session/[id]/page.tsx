import { notFound, redirect } from "next/navigation";

import { isIntentionKey, DEFAULT_INTENTION } from "@/lib/guided";
import { getCurrentUser } from "@/lib/auth";
import type { ProofSummary } from "@/lib/server/ai/guided";
import { getGuidedState } from "@/lib/server/sessions";
import { SessionView, type SessionInitial } from "./session-view";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/sign-in?next=/session/${id}`);

  const state = await getGuidedState(id, user.id);
  if (!state) notFound();

  const intention = isIntentionKey(state.session.intention)
    ? state.session.intention
    : DEFAULT_INTENTION;

  const initial: SessionInitial = {
    session: {
      id: state.session.id,
      topic: state.session.problemText,
      intention,
      status: state.session.status,
      totalSteps: state.session.totalSteps,
      pasted: state.session.pasted,
      summary: (state.session.summary as ProofSummary | null) ?? null,
      startedAt: state.session.startedAt.toISOString(),
      elapsedSeconds: state.session.elapsedSeconds,
    },
    moves: state.steps.map((s) => ({
      stepNum: s.stepNum,
      kind: s.kind,
      question: s.question,
      answer: s.userResponse,
    })),
  };

  return <SessionView key={initial.session.id} initial={initial} />;
}
