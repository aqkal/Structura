import { randomUUID } from "node:crypto";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { errorName, logEvent } from "@/lib/server/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * The private bucket that holds chat attachments. All storage access uses
 * the signed-in user's own session (see uploadAttachment /
 * downloadAttachmentBytes), so Storage RLS scopes every operation to the
 * owner's folder. No service-role key is involved at runtime.
 */
const CHAT_UPLOADS_BUCKET = "chat-uploads";

/* ------------------------------------------------------------------
   Validation constants. These are enforced server-side on every
   upload; the browser never touches storage directly.
   ------------------------------------------------------------------ */

export const ALLOWED_MEDIA = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

/** Total attachment bytes a single message may carry to the model. */
export const MAX_MESSAGE_ATTACHMENT_BYTES = 30 * 1024 * 1024;

/** Per-user storage a single UTC day may accumulate. */
export const DAILY_STORAGE_BUDGET_BYTES = Number(
  process.env.STORAGE_DAILY_BUDGET_BYTES ?? 250 * 1024 * 1024,
);

/**
 * Verify the file's actual leading bytes match the claimed media type.
 * The browser-supplied `file.type` is not trustworthy: a client can label
 * an HTML or script payload as image/png. We sniff the magic number so a
 * spoofed type is rejected before it is ever stored or served back.
 */
export function bytesMatchMediaType(
  bytes: Uint8Array,
  mediaType: string,
): boolean {
  const b = bytes;
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((v, i) => b[offset + i] === v);
  switch (mediaType) {
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWith([0x47, 0x49, 0x46, 0x38]); // GIF8
    case "image/webp":
      // "RIFF" .... "WEBP"
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        startsWith([0x57, 0x45, 0x42, 0x50], 8)
      );
    case "application/pdf":
      return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    default:
      return false;
  }
}

export type AttachmentRow = typeof schema.chatAttachments.$inferSelect;

/**
 * Every externally supplied id is validated before it reaches a query so
 * a malformed uuid reads as "not found", never a Postgres cast error.
 */
const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * Map an allowed media type to the file extension used in the storage
 * path. Anything unrecognized falls back to "bin"; callers validate the
 * media type against ALLOWED_MEDIA first, so "bin" only ever appears for
 * defensive reasons.
 */
export function extForMedia(mediaType: string): string {
  switch (mediaType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

/**
 * Upload a single attachment to the private bucket and record its
 * metadata. NOT owner-scoped: the caller must verify (via guardChat) that
 * the chat belongs to the user before calling this. The message link is
 * deferred (messageId stays null) until the message row exists.
 */
export async function uploadAttachment(args: {
  userId: string;
  chatId: string;
  bytes: Uint8Array;
  mediaType: string;
  fileName: string;
}): Promise<AttachmentRow> {
  const { userId, chatId, bytes, mediaType, fileName } = args;

  if (!(ALLOWED_MEDIA as readonly string[]).includes(mediaType)) {
    throw new Error("unsupported_type");
  }
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new Error("too_large");
  }
  // The claimed media type is from the browser. Confirm the real bytes
  // match, so a script/HTML payload cannot masquerade as an allowed image.
  if (!bytesMatchMediaType(bytes, mediaType)) {
    throw new Error("content_mismatch");
  }

  // Path is "{userId}/{chatId}/{uuid}.ext". The first folder segment is the
  // owner id, which Storage RLS checks against auth.uid(), so a user can
  // only ever write into their own folder even though we also pass userId.
  const path = `${userId}/${chatId}/${randomUUID()}.${extForMedia(mediaType)}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(CHAT_UPLOADS_BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: false });
  if (uploadError) {
    throw new Error(`storage_upload_failed: ${uploadError.message}`);
  }

  const safeFileName = fileName.slice(0, 200);

  const [row] = await db
    .insert(schema.chatAttachments)
    .values({
      chatId,
      messageId: null,
      userId,
      storagePath: path,
      mediaType,
      fileName: safeFileName,
      sizeBytes: bytes.length,
    })
    .returning();

  return row;
}

/**
 * Bytes this user has uploaded so far in the current UTC day, used to
 * enforce a per-user daily storage budget and stop a single account from
 * filling the bucket.
 */
export async function storageUsedTodayBytes(userId: string): Promise<number> {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.chatAttachments.sizeBytes}), 0)`,
    })
    .from(schema.chatAttachments)
    .where(
      and(
        eq(schema.chatAttachments.userId, userId),
        gte(schema.chatAttachments.createdAt, dayStart),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * All attachments for a chat in creation order. NOT owner-scoped: the
 * caller verifies ownership of the parent chat first.
 */
export async function listAttachmentsForChat(
  chatId: string,
): Promise<AttachmentRow[]> {
  if (!isUuid(chatId)) return [];
  return db
    .select()
    .from(schema.chatAttachments)
    .where(eq(schema.chatAttachments.chatId, chatId))
    .orderBy(asc(schema.chatAttachments.createdAt));
}

/**
 * Fetch attachments by id, scoped to a single chat. Malformed ids are
 * silently dropped; an empty (or fully-invalid) id list returns []. The
 * chatId scope is the ownership boundary: the caller must have already
 * confirmed the chat belongs to the user.
 */
export async function getAttachmentsByIds(
  ids: string[],
  chatId: string,
): Promise<AttachmentRow[]> {
  if (!isUuid(chatId)) return [];
  const validIds = ids.filter((id) => isUuid(id));
  if (validIds.length === 0) return [];

  return db
    .select()
    .from(schema.chatAttachments)
    .where(
      and(
        inArray(schema.chatAttachments.id, validIds),
        eq(schema.chatAttachments.chatId, chatId),
      ),
    );
}

/**
 * Link a set of (already chat-scoped) attachments to a freshly created
 * message. Only rows matching both the id list and the chatId are
 * touched, so this cannot reassign another chat's attachments.
 */
export async function linkAttachmentsToMessage(
  ids: string[],
  messageId: string,
  chatId: string,
): Promise<void> {
  if (!isUuid(chatId) || !isUuid(messageId)) return;
  const validIds = ids.filter((id) => isUuid(id));
  if (validIds.length === 0) return;

  await db
    .update(schema.chatAttachments)
    .set({ messageId })
    .where(
      and(
        inArray(schema.chatAttachments.id, validIds),
        eq(schema.chatAttachments.chatId, chatId),
      ),
    );
}

/**
 * Download the raw bytes for a stored attachment. The caller is
 * responsible for having resolved the storagePath from an owner-scoped
 * row first.
 */
export async function downloadAttachmentBytes(
  storagePath: string,
): Promise<Uint8Array> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(CHAT_UPLOADS_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      `storage_download_failed: ${error?.message ?? "no data returned"}`,
    );
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Supabase client bound to the signed-in user's session. */
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Best-effort removal of objects from the chat-uploads bucket, using
 * the caller's OWN session client so Storage RLS keeps the operation
 * scoped to the signed-in user's folder (no service-role key at
 * runtime). Failures are logged and swallowed: storage cleanup must
 * never block a user-facing delete, an orphaned object is the lesser
 * harm.
 */
export async function removeStorageObjects(
  client: ServerSupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await client.storage
      .from(CHAT_UPLOADS_BUCKET)
      .remove(paths);
    if (error) {
      logEvent("storage_cleanup_failed", {
        count: paths.length,
        errorName: error.name || "StorageError",
      });
    }
  } catch (err) {
    logEvent("storage_cleanup_failed", {
      count: paths.length,
      errorName: errorName(err),
    });
  }
}

/**
 * Owner-scoped fetch of a single attachment. Returns null if the id is
 * malformed, the row is missing, or it is not owned by the user.
 */
export async function getAttachmentForUser(
  attachmentId: string,
  userId: string,
): Promise<AttachmentRow | null> {
  if (!isUuid(attachmentId)) return null;
  const [row] = await db
    .select()
    .from(schema.chatAttachments)
    .where(
      and(
        eq(schema.chatAttachments.id, attachmentId),
        eq(schema.chatAttachments.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}
