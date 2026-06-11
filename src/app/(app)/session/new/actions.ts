"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/server/audit";
import { createSession, ensureUserRow } from "@/lib/server/sessions";
import {
  createSessionInput,
  findInjectionMarker,
} from "@/lib/server/validators";

export async function createSessionAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in first." };

  const parsed = createSessionInput.safeParse({
    problemText: formData.get("problemText"),
    subjectSlug: formData.get("subjectSlug"),
    scaffoldMode: formData.get("scaffoldMode"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check your input.",
    };
  }

  if (findInjectionMarker(parsed.data.problemText)) {
    logEvent("injection_marker", { where: "create_session" });
    return {
      error:
        "That problem statement contains instructions aimed at the AI. Please describe the problem itself.",
    };
  }

  await ensureUserRow(user);
  const id = await createSession(user.id, parsed.data);
  logEvent("session_created", {
    sessionId: id,
    subject: parsed.data.subjectSlug,
  });
  redirect("/session/" + id);
}
