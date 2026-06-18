import type { SupabaseClient } from "@supabase/supabase-js";
import { asc, count, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

const CHAT_UPLOADS_BUCKET = "chat-uploads";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const STORAGE_PAGE_SIZE = 100;

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) {
      list.push(row);
    } else {
      map.set(k, [row]);
    }
  }
  return map;
}

export type AccountExportResult = {
  data: Record<string, unknown>;

  counts: Record<string, number>;
};

export async function buildAccountExport(
  userId: string,
): Promise<AccountExportResult> {
  const [userRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const sessionRows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))
    .orderBy(asc(schema.sessions.startedAt));
  const sessionIds = sessionRows.map((s) => s.id);

  const stepRows =
    sessionIds.length > 0
      ? await db
          .select()
          .from(schema.steps)
          .where(inArray(schema.steps.sessionId, sessionIds))
          .orderBy(asc(schema.steps.stepNum))
      : [];
  const stepIds = stepRows.map((s) => s.id);

  const hintRows =
    stepIds.length > 0
      ? await db
          .select()
          .from(schema.hints)
          .where(inArray(schema.hints.stepId, stepIds))
          .orderBy(asc(schema.hints.createdAt))
      : [];

  const confidenceRows =
    sessionIds.length > 0
      ? await db
          .select()
          .from(schema.confidenceRatings)
          .where(inArray(schema.confidenceRatings.sessionId, sessionIds))
          .orderBy(asc(schema.confidenceRatings.createdAt))
      : [];

  const retrospectiveRows =
    sessionIds.length > 0
      ? await db
          .select()
          .from(schema.retrospectives)
          .where(inArray(schema.retrospectives.sessionId, sessionIds))
          .orderBy(asc(schema.retrospectives.createdAt))
      : [];

  const chatRows = await db
    .select()
    .from(schema.chats)
    .where(eq(schema.chats.userId, userId))
    .orderBy(asc(schema.chats.createdAt));
  const chatIds = chatRows.map((c) => c.id);

  const messageRows =
    chatIds.length > 0
      ? await db
          .select()
          .from(schema.chatMessages)
          .where(inArray(schema.chatMessages.chatId, chatIds))
          .orderBy(asc(schema.chatMessages.createdAt))
      : [];

  const attachmentRows = await db
    .select()
    .from(schema.chatAttachments)
    .where(eq(schema.chatAttachments.userId, userId))
    .orderBy(asc(schema.chatAttachments.createdAt));

  const usageByKind = await db
    .select({ kind: schema.usageEvents.kind, calls: count() })
    .from(schema.usageEvents)
    .where(eq(schema.usageEvents.userId, userId))
    .groupBy(schema.usageEvents.kind);
  const totalAiCalls = usageByKind.reduce((sum, row) => sum + row.calls, 0);

  const supabase = await createClient();
  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    attachmentRows.map(async (att) => {
      try {
        const { data, error } = await supabase.storage
          .from(CHAT_UPLOADS_BUCKET)
          .createSignedUrl(att.storagePath, SIGNED_URL_TTL_SECONDS);
        signedUrls.set(att.id, error ? null : (data?.signedUrl ?? null));
      } catch {
        signedUrls.set(att.id, null);
      }
    }),
  );

  const hintsByStep = groupBy(hintRows, (h) => h.stepId);
  const stepsBySession = groupBy(stepRows, (s) => s.sessionId);
  const confidenceBySession = groupBy(confidenceRows, (c) => c.sessionId);
  const retrosBySession = groupBy(retrospectiveRows, (r) => r.sessionId);
  const messagesByChat = groupBy(messageRows, (m) => m.chatId);
  const attachmentsByChat = groupBy(attachmentRows, (a) => a.chatId);

  const data: Record<string, unknown> = {
    format: "structura-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: {
      scope:
        "Everything Qualia stores about you: profile, guided sessions, chats, uploaded file metadata, and AI usage counts.",
      attachments:
        "Each attachment includes a signed download link that expires one hour after this export was created. The storagePath identifies the file if the link has expired.",
    },
    user: userRow
      ? {
          id: userRow.id,
          email: userRow.email,
          displayName: userRow.displayName,
          avatarUrl: userRow.avatarUrl,
          createdAt: userRow.createdAt,
        }
      : null,
    sessions: sessionRows.map((session) => ({
      ...session,
      steps: (stepsBySession.get(session.id) ?? []).map((step) => ({
        ...step,
        hints: hintsByStep.get(step.id) ?? [],
      })),
      confidenceRatings: confidenceBySession.get(session.id) ?? [],
      retrospectives: retrosBySession.get(session.id) ?? [],
    })),
    chats: chatRows.map((chat) => ({
      ...chat,
      messages: messagesByChat.get(chat.id) ?? [],
      attachments: (attachmentsByChat.get(chat.id) ?? []).map((att) => ({
        id: att.id,
        messageId: att.messageId,
        fileName: att.fileName,
        mediaType: att.mediaType,
        sizeBytes: att.sizeBytes,
        storagePath: att.storagePath,
        createdAt: att.createdAt,
        signedUrl: signedUrls.get(att.id) ?? null,
      })),
    })),
    usageSummary: {
      totalAiCalls,
      byKind: Object.fromEntries(
        usageByKind.map((row) => [row.kind, row.calls]),
      ),
    },
  };

  const counts: Record<string, number> = {
    sessions: sessionRows.length,
    steps: stepRows.length,
    hints: hintRows.length,
    confidenceRatings: confidenceRows.length,
    retrospectives: retrospectiveRows.length,
    chats: chatRows.length,
    messages: messageRows.length,
    attachments: attachmentRows.length,
    aiCalls: totalAiCalls,
  };

  return { data, counts };
}

async function collectUserStoragePaths(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const files: string[] = [];
  const folders: string[] = [userId];

  while (folders.length > 0) {
    const folder = folders.pop() as string;
    let offset = 0;

    for (;;) {
      const { data, error } = await admin.storage
        .from(CHAT_UPLOADS_BUCKET)
        .list(folder, {
          limit: STORAGE_PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) {
        throw new Error("storage_list_failed");
      }

      const entries = data ?? [];
      for (const entry of entries) {
        const fullPath = `${folder}/${entry.name}`;
        if (!entry.id) {
          folders.push(fullPath);
        } else {
          files.push(fullPath);
        }
      }

      if (entries.length < STORAGE_PAGE_SIZE) break;
      offset += STORAGE_PAGE_SIZE;
    }
  }

  return files;
}

export async function purgeUserStorage(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const paths = await collectUserStoragePaths(admin, userId);
  let removed = 0;

  for (let i = 0; i < paths.length; i += STORAGE_PAGE_SIZE) {
    const batch = paths.slice(i, i + STORAGE_PAGE_SIZE);
    const { error } = await admin.storage
      .from(CHAT_UPLOADS_BUCKET)
      .remove(batch);
    if (error) {
      throw new Error("storage_remove_failed");
    }
    removed += batch.length;
  }

  return removed;
}

export async function deleteUserRow(userId: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.users)
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });
  return deleted.length > 0;
}
