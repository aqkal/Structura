import type { NextRequest } from "next/server";

import { apiError } from "@/lib/server/api-error";
import { errorName, logEvent } from "@/lib/server/audit";
import {
  downloadAttachmentBytes,
  getAttachmentForUser,
} from "@/lib/server/attachments";
import { guardChat } from "@/lib/server/chat-guard";

/**
 * GET /api/chat/{id}/attachment/{attachmentId}
 *
 * Streams a previously uploaded attachment's bytes back to the owner. The
 * bucket is private, so this is the only way the browser can render an
 * uploaded image or open an uploaded PDF. Ownership is enforced twice:
 * guardChat on the parent chat, plus getAttachmentForUser scoped to the
 * signed-in user, with a final check that the attachment belongs to THIS
 * chat. Anything that fails reads as 404, never as 403.
 */
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
    // Copy into a fresh ArrayBuffer so the body is a concrete BodyInit. The
    // returned Uint8Array is typed over ArrayBufferLike, which the DOM lib
    // does not accept directly as a BlobPart.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const body = new Blob([buffer], { type: att.mediaType });
    return new Response(body, {
      headers: {
        "content-type": att.mediaType,
        "cache-control": "private, max-age=3600",
        // Force the declared type (no MIME sniffing) and neutralize any
        // active content: even if a file slipped through, the sandbox CSP
        // stops scripts and the nosniff header stops type promotion.
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
