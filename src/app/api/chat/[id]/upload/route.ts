import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  ALLOWED_MEDIA,
  DAILY_STORAGE_BUDGET_BYTES,
  MAX_ATTACHMENT_BYTES,
  MAX_DAILY_UPLOADS,
  UPLOADS_PER_MINUTE,
  storageUsedTodayBytes,
  uploadAttachment,
  uploadsCountToday,
} from "@/lib/server/attachments";
import { checkCustomLimit } from "@/lib/server/rate-limit";
import { guardChat } from "@/lib/server/chat-guard";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const rate = await checkCustomLimit(`upload:${user.id}`, UPLOADS_PER_MINUTE);
  if (!rate.allowed) {
    return apiError(429, "upload_rate_limited", "Slow down a moment.", {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ATTACHMENT_BYTES + 1024 * 1024) {
    return apiError(400, "too_large", "That file is too large.");
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return apiError(400, "bad_request", "Expected a file upload.");
  }

  const mediaType = file.type;
  if (!(ALLOWED_MEDIA as readonly string[]).includes(mediaType)) {
    return apiError(
      400,
      "unsupported_type",
      "That file type is not supported.",
    );
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return apiError(400, "too_large", "That file is too large.");
  }

  const countToday = await uploadsCountToday(user.id);
  if (countToday >= MAX_DAILY_UPLOADS) {
    return apiError(
      429,
      "storage_quota_exceeded",
      `Daily upload limit reached (${MAX_DAILY_UPLOADS} files). Try again tomorrow.`,
    );
  }

  const usedToday = await storageUsedTodayBytes(user.id);
  if (usedToday + file.size > DAILY_STORAGE_BUDGET_BYTES) {
    return apiError(
      429,
      "storage_quota_exceeded",
      "Daily upload size limit reached. Try again tomorrow.",
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file instanceof File ? file.name : "upload";
    const row = await uploadAttachment({
      userId: user.id,
      chatId: id,
      bytes,
      mediaType,
      fileName: fileName || "upload",
    });

    logEvent("attachment_uploaded", {
      chatId: id,
      mediaType: row.mediaType,
      sizeBytes: row.sizeBytes,
    });

    return Response.json({
      id: row.id,
      mediaType: row.mediaType,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "unsupported_type") {
      return apiError(
        400,
        "unsupported_type",
        "That file type is not supported.",
      );
    }
    if (message === "too_large") {
      return apiError(400, "too_large", "That file is too large.");
    }
    if (message === "content_mismatch") {
      return apiError(
        400,
        "content_mismatch",
        "That file's contents do not match its type.",
      );
    }
    logEvent("persist_failed", {
      route: "chat-upload",
      chatId: id,
      errorName: errorName(err),
    });
    return apiError(500, "upload_failed");
  }
}
