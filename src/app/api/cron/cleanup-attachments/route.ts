import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  ATTACHMENT_RETENTION_DAYS,
  CHAT_UPLOADS_BUCKET,
  deleteAttachmentRows,
  listExpiredAttachments,
} from "@/lib/server/attachments";
import { pruneRateLimits } from "@/lib/server/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError(401, "unauthorized");
  }

  if (
    !Number.isFinite(ATTACHMENT_RETENTION_DAYS) ||
    ATTACHMENT_RETENTION_DAYS <= 0
  ) {
    return Response.json({ removed: 0, retention: "disabled" });
  }

  const admin = getAdminClient();
  let removed = 0;

  try {
    for (let i = 0; i < 50; i++) {
      const batch = await listExpiredAttachments(
        ATTACHMENT_RETENTION_DAYS,
        500,
      );
      if (batch.length === 0) break;

      const { error } = await admin.storage
        .from(CHAT_UPLOADS_BUCKET)
        .remove(batch.map((b) => b.storagePath));
      if (error) {
        logEvent("cron_cleanup_failed", { removed, errorName: error.name });
        return apiError(502, "cleanup_failed");
      }

      await deleteAttachmentRows(batch.map((b) => b.id));
      removed += batch.length;
      if (batch.length < 500) break;
    }
  } catch (err) {
    logEvent("cron_cleanup_failed", { removed, errorName: errorName(err) });
    return apiError(502, "cleanup_failed");
  }

  let prunedRateLimits = 0;
  try {
    prunedRateLimits = await pruneRateLimits();
  } catch (err) {
    logEvent("cron_prune_ratelimits_failed", { errorName: errorName(err) });
  }

  logEvent("cron_cleanup", { removed, prunedRateLimits });
  return Response.json({ removed, prunedRateLimits });
}
