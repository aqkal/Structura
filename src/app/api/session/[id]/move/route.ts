import type { NextRequest } from "next/server";

import { INTENTIONS, isIntentionKey, type MoveKind } from "@/lib/guided";
import { generateMove } from "@/lib/server/ai/guided";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { guardSession } from "@/lib/server/session-guard";
import { appendMove } from "@/lib/server/sessions";
import { beginUsage, deleteUsage, finishUsage } from "@/lib/server/usage";
import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";

import { aiBudgetHeaders, budgetGate } from "../shared";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardSession(id);
  if (!guard.ok) return guard.response;
  const { user, session } = guard;

  const raw = (await req.json().catch(() => null)) as {
    model?: unknown;
  } | null;
  const modelId = typeof raw?.model === "string" ? raw.model : undefined;

  if (session.status !== "active") {
    return apiError(400, "session_not_active", "This session is finished.");
  }
  if (!isIntentionKey(session.intention)) {
    return apiError(400, "bad_intention", "This session has no intention.");
  }
  const playbook = INTENTIONS[session.intention].moves;

  const steps = await db
    .select()
    .from(schema.steps)
    .where(eq(schema.steps.sessionId, session.id))
    .orderBy(asc(schema.steps.stepNum));

  const last = steps[steps.length - 1];
  if (last && last.userResponse === null) {
    return new Response(
      JSON.stringify({
        stepNum: last.stepNum,
        kind: last.kind,
        question: last.question,
      }),
      {
        headers: {
          "content-type": "application/json",
          ...(await budgetHeadersSnapshot(user.id)),
        },
      },
    );
  }

  const nextIndex = steps.length;
  if (nextIndex >= playbook.length) {
    return apiError(409, "no_more_moves", "All moves are done.");
  }
  const kind = playbook[nextIndex] as MoveKind;

  const gate = await budgetGate(user.id);
  if (gate.blocked) return gate.blocked;

  const usageId = await beginUsage({
    userId: user.id,
    sessionId: session.id,
    kind: "scaffold",
    model: "",
  });

  try {
    const result = await generateMove({
      intention: session.intention,
      topic: session.problemText,
      moveKind: kind,
      modelId,
      history: steps.map((s) => ({
        kind: (s.kind as MoveKind) ?? "offer-context",
        question: s.question,
        answer: s.userResponse,
      })),
    });
    await appendMove({
      sessionId: session.id,
      stepNum: nextIndex,
      kind,
      question: result.text,
    });
    await finishUsage(usageId, result.inputTokens, result.outputTokens);
    logEvent("guided_move", {
      sessionId: session.id,
      stepNum: nextIndex,
      kind,
    });

    return new Response(
      JSON.stringify({ stepNum: nextIndex, kind, question: result.text }),
      {
        headers: {
          "content-type": "application/json",
          ...aiBudgetHeaders(gate.used + 1, gate.budget),
        },
      },
    );
  } catch (err) {
    await deleteUsage(usageId);
    logEvent("guided_move_failed", {
      sessionId: session.id,
      stepNum: nextIndex,
      errorName: errorName(err),
    });
    return apiError(502, "ai_failed", "Could not generate the next move.");
  }
}

async function budgetHeadersSnapshot(
  userId: string,
): Promise<Record<string, string>> {
  const { used, budget } = await budgetGate(userId).then((g) => ({
    used: g.used,
    budget: g.budget,
  }));
  return aiBudgetHeaders(used, budget);
}
