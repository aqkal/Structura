"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { isIntentionKey, DEFAULT_INTENTION } from "@/lib/guided";
import { logEvent } from "@/lib/server/audit";
import { createGuidedSession, ensureUserRow } from "@/lib/server/sessions";
import { findInjectionMarker, topicInput } from "@/lib/server/validators";

export async function createSessionAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in first." };

  const parsed = topicInput.safeParse({ topic: formData.get("topic") });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check your input.",
    };
  }

  const rawIntention = formData.get("intention");
  const intention = isIntentionKey(rawIntention)
    ? rawIntention
    : DEFAULT_INTENTION;

  if (findInjectionMarker(parsed.data.topic)) {
    logEvent("injection_marker", { where: "create_session" });
    return {
      error:
        "That topic contains instructions aimed at the AI. Please describe the topic itself.",
    };
  }

  await ensureUserRow(user);
  const id = await createGuidedSession(user.id, {
    topic: parsed.data.topic,
    intention,
  });
  logEvent("session_created", { sessionId: id, intention });
  redirect("/session/" + id);
}
