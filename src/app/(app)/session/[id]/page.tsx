import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getSessionState } from "@/lib/server/sessions";
import { SessionView, type SessionInitial } from "./session-view";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/sign-in?next=/session/${id}`);

  const state = await getSessionState(id, user.id);
  if (!state) notFound();

  const initial: SessionInitial = {
    session: {
      id: state.session.id,
      problemText: state.session.problemText,
      subjectSlug: state.session.subjectSlug,
      scaffoldMode: state.session.scaffoldMode,
      status: state.session.status,
      totalSteps: state.session.totalSteps,
      currentStep: state.session.currentStep,
      hintsUsed: state.session.hintsUsed,
      rewrites: state.session.rewrites,
      startedAt: state.session.startedAt.toISOString(),
      endedAt: state.session.endedAt?.toISOString() ?? null,
      elapsedSeconds: state.session.elapsedSeconds,
    },
    steps: state.steps.map((s) => ({
      stepNum: s.stepNum,
      question: s.question,
      userResponse: s.userResponse,
      aiFeedback: s.aiFeedback,
      completedAt: s.completedAt?.toISOString() ?? null,
      revisionCount: s.revisionCount,
    })),
    hintsByStep: state.hintsByStep,
    confidence: state.confidence,
  };

  return <SessionView key={initial.session.id} initial={initial} />;
}
