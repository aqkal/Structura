import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  ALLOWED_MEDIA,
  DAILY_STORAGE_BUDGET_BYTES,
  MAX_ATTACHMENT_BYTES,
  storageUsedTodayBytes,
  uploadAttachment,
} from "@/lib/server/attachments";
import { guardChat } from "@/lib/server/chat-guard";

/**
 * POST /api/chat/{id}/upload
 *
 * Accepts a single file (multipart/form-data, field "file") and stores it
 * in the private chat-uploads bucket under "{userId}/{chatId}/{uuid}.{ext}".
 * The browser NEVER touches storage directly: ownership is checked here via
 * guardChat, and every file is validated server-side (mediaType allowlist,
 * size cap). The returned row id is later linked to a message when the
 * student sends their turn.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  // Reject oversized payloads before reading the whole multipart body, so a
  // huge or slow upload cannot force us to buffer it just to fail the size
  // check afterward. (Defense in depth: file.size is re-checked below.)
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

  // Per-user daily storage budget, so one account cannot fill the bucket.
  const usedToday = await storageUsedTodayBytes(user.id);
  if (usedToday + file.size > DAILY_STORAGE_BUDGET_BYTES) {
    return apiError(
      429,
      "storage_quota_exceeded",
      "Daily upload limit reached. Try again tomorrow.",
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
