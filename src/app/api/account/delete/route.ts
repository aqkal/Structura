import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deleteUserRow, purgeUserStorage } from "@/lib/server/account";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Delete attempts a single user may make per hour. */
const DELETES_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The client repeats the typed confirmation so a stray fetch can never
 * delete an account by accident.
 */
const deleteAccountInput = z.object({
  confirm: z.literal("delete"),
});

/**
 * POST /api/account/delete
 *
 * Permanently deletes the signed-in user's account. Stage order matters:
 *
 *   1. Storage: remove every object under "{userId}/..." in chat-uploads
 *      using the service-role client (the single sanctioned admin-job use
 *      per SECURITY.md). Runs first so a mid-way failure leaves the
 *      account intact and fully retryable.
 *   2. DB: delete the users row; FK cascades clear sessions, steps, hints,
 *      confidence ratings, retrospectives, chats, messages, attachment
 *      rows, scheduled tasks, and usage events.
 *   3. Auth: remove the auth.users record via the admin client.
 *   4. Sign out with the user's own client so the auth cookies are cleared.
 *
 * Every stage tolerates already-deleted state, so a retry after a mid-way
 * failure finishes the remaining stages instead of erroring.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = checkCustomLimit(
    `account-delete:${user.id}`,
    DELETES_PER_HOUR,
    HOUR_MS,
  );
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Please wait before trying again.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const raw: unknown = await req.json().catch(() => null);
  const parsed = deleteAccountInput.safeParse(raw);
  if (!parsed.success) {
    return apiError(400, "bad_request", 'Type "delete" to confirm.');
  }

  const admin = getAdminClient();

  // Stage 1: storage. An empty or already-purged folder removes zero
  // objects and succeeds, so retries pass straight through.
  let removedObjects = 0;
  try {
    removedObjects = await purgeUserStorage(admin, user.id);
    logEvent("account_delete_storage", { removedObjects });
  } catch (err) {
    logEvent("account_delete_failed", {
      stage: "storage",
      errorName: errorName(err),
    });
    return apiError(
      500,
      "delete_failed",
      "Deletion did not finish. Nothing was lost beyond what you asked to remove. Please try again.",
    );
  }

  // Stage 2: DB row + cascades. Returns false if a previous attempt
  // already removed it; that is fine.
  try {
    const dbRowDeleted = await deleteUserRow(user.id);
    logEvent("account_delete_db", { dbRowDeleted });
  } catch (err) {
    logEvent("account_delete_failed", {
      stage: "db",
      errorName: errorName(err),
    });
    return apiError(
      500,
      "delete_failed",
      "Deletion did not finish. Please try again.",
    );
  }

  // Stage 3: auth user. A 404 means a previous attempt already removed it.
  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error && error.status !== 404) {
      throw new Error("auth_delete_failed");
    }
    logEvent("account_delete_auth", { alreadyGone: error?.status === 404 });
  } catch (err) {
    logEvent("account_delete_failed", {
      stage: "auth",
      errorName: errorName(err),
    });
    return apiError(
      500,
      "delete_failed",
      "Deletion did not finish. Please try again.",
    );
  }

  // Stage 4: clear the auth cookies. Best effort: the auth user is gone,
  // so even if sign-out fails the session is dead on the next request.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Tolerated: cookies for a deleted user cannot authenticate anything.
  }

  logEvent("account_deleted", { removedObjects });
  return Response.json({ ok: true });
}
