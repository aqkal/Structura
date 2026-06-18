import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  downloadAttachmentBytes,
  getAttachmentForUser,
} from "@/lib/server/attachments";
import { guardChat } from "@/lib/server/chat-guard";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const att = await getAttachmentForUser(attachmentId, user.id);
  if (!att || att.chatId !== id) {
    return apiError(404, "not_found");
  }

  try {
    const bytes = await downloadAttachmentBytes(att.storagePath);

    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const body = new Blob([buffer], { type: att.mediaType });
    return new Response(body, {
      headers: {
        "content-type": att.mediaType,
        "cache-control": "private, max-age=3600",

        "x-content-type-options": "nosniff",
        "content-security-policy":
          "default-src 'none'; sandbox; img-src 'self' data:; object-src 'none'",
        "content-disposition": `inline; filename="${encodeURIComponent(
          att.fileName,
        )}"`,
      },
    });
  } catch (err) {
    logEvent("persist_failed", {
      route: "chat-attachment",
      chatId: id,
      errorName: errorName(err),
    });
    return apiError(500, "download_failed");
  }
}
