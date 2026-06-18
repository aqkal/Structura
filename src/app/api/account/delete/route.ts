import type { NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deleteUserRow, purgeUserStorage } from "@/lib/server/account";
import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DELETES_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

const deleteAccountInput = z.object({
  confirm: z.literal("delete"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = await checkCustomLimit(
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

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {}

  logEvent("account_deleted", { removedObjects });
  return Response.json({ ok: true });
}
