import { randomUUID } from "node:crypto";

import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { errorName, logEvent } from "@/lib/server/audit";
import { createClient } from "@/lib/supabase/server";

export const CHAT_UPLOADS_BUCKET = "chat-uploads";

export const ALLOWED_MEDIA = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

export const MAX_MESSAGE_ATTACHMENT_BYTES = 30 * 1024 * 1024;

export const DAILY_STORAGE_BUDGET_BYTES = Number(
  process.env.STORAGE_DAILY_BUDGET_BYTES ?? 250 * 1024 * 1024,
);

export const MAX_DAILY_UPLOADS = Number(
  process.env.STORAGE_DAILY_FILE_LIMIT ?? 50,
);

export const UPLOADS_PER_MINUTE = Number(
  process.env.STORAGE_UPLOADS_PER_MINUTE ?? 20,
);

export const ATTACHMENT_RETENTION_DAYS = Number(
  process.env.ATTACHMENT_RETENTION_DAYS ?? 30,
);

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
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        startsWith([0x57, 0x45, 0x42, 0x50], 8)
      );
    case "application/pdf":
      return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]);
    default:
      return false;
  }
}

export type AttachmentRow = typeof schema.chatAttachments.$inferSelect;

const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

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

  if (!bytesMatchMediaType(bytes, mediaType)) {
    throw new Error("content_mismatch");
  }

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

export async function uploadsCountToday(userId: string): Promise<number> {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [row] = await db
    .select({ value: count() })
    .from(schema.chatAttachments)
    .where(
      and(
        eq(schema.chatAttachments.userId, userId),
        gte(schema.chatAttachments.createdAt, dayStart),
      ),
    );
  return row?.value ?? 0;
}

export async function listExpiredAttachments(
  beforeDays: number,
  limit = 500,
): Promise<{ id: string; storagePath: string }[]> {
  const cutoff = new Date(Date.now() - beforeDays * 86_400_000);
  return db
    .select({
      id: schema.chatAttachments.id,
      storagePath: schema.chatAttachments.storagePath,
    })
    .from(schema.chatAttachments)
    .where(lt(schema.chatAttachments.createdAt, cutoff))
    .limit(limit);
}

export async function deleteAttachmentRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .delete(schema.chatAttachments)
    .where(inArray(schema.chatAttachments.id, ids));
}

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

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
