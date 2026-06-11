import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";

export type ChatRow = typeof schema.chats.$inferSelect;
export type ChatMessageRow = typeof schema.chatMessages.$inferSelect;

/**
 * Every externally supplied chatId is validated before it reaches a
 * query. A malformed uuid must read as "not found", never as a Postgres
 * cast error bubbling up to the route.
 */
const uuidSchema = z.string().uuid();

function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

export async function createChat(
  userId: string,
  title?: string,
): Promise<string> {
  const [row] = await db
    .insert(schema.chats)
    .values({
      userId,
      // Let the DB default fill in "New chat" when no title is given.
      ...(title !== undefined ? { title } : {}),
    })
    .returning({ id: schema.chats.id });
  return row.id;
}

export async function getChatForUser(
  chatId: string,
  userId: string,
): Promise<ChatRow | null> {
  if (!isUuid(chatId)) return null;
  const [row] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listChats(
  userId: string,
  limit = 50,
): Promise<ChatRow[]> {
  return db
    .select()
    .from(schema.chats)
    .where(eq(schema.chats.userId, userId))
    .orderBy(desc(schema.chats.updatedAt))
    .limit(limit);
}

export async function getChatMessages(
  chatId: string,
): Promise<ChatMessageRow[]> {
  if (!isUuid(chatId)) return [];
  return db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.chatId, chatId))
    .orderBy(asc(schema.chatMessages.createdAt));
}

export type ChatWithMessages = {
  chat: ChatRow;
  messages: ChatMessageRow[];
};

/**
 * Owner-scoped fetch of a chat and its messages in order. Returns null
 * if the chat is missing, not owned by the user, or the id is malformed.
 */
export async function getChatWithMessages(
  chatId: string,
  userId: string,
): Promise<ChatWithMessages | null> {
  const chat = await getChatForUser(chatId, userId);
  if (!chat) return null;

  const messages = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.chatId, chat.id))
    .orderBy(asc(schema.chatMessages.createdAt));

  return { chat, messages };
}

/**
 * Append a message and bump the parent chat's updatedAt in one
 * transaction so the chat list ordering stays in sync with the latest
 * activity. Not owner-scoped: callers must verify ownership first.
 */
export async function appendMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.chatMessages)
      .values({ chatId, role, content })
      .returning({ id: schema.chatMessages.id });
    await tx
      .update(schema.chats)
      .set({ updatedAt: new Date() })
      .where(eq(schema.chats.id, chatId));
    return row.id;
  });
}

/**
 * Owner-scoped rename. Trims and caps the title to 80 characters.
 * Returns false if the chat is not owned by the user or the id is
 * malformed.
 */
export async function renameChat(
  chatId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  if (!isUuid(chatId)) return false;

  const cleaned = title.trim().slice(0, 80);

  const updated = await db
    .update(schema.chats)
    .set({ title: cleaned, updatedAt: new Date() })
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .returning({ id: schema.chats.id });

  return updated.length > 0;
}

/**
 * Owner-scoped delete. Messages are removed by the foreign-key cascade.
 * Returns false if the chat is not owned by the user or the id is
 * malformed.
 */
export async function deleteChat(
  chatId: string,
  userId: string,
): Promise<boolean> {
  if (!isUuid(chatId)) return false;

  const deleted = await db
    .delete(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .returning({ id: schema.chats.id });

  return deleted.length > 0;
}

/**
 * In one transaction, verify the chat's most recent message is still
 * the assistant reply the caller saw and delete it. Returns false
 * (deleting nothing) when the conversation moved on in the meantime or
 * the last message is not an assistant turn. Not owner-scoped: callers
 * must verify ownership first.
 */
export async function deleteLastAssistantMessage(
  chatId: string,
  expectedMessageId: string,
): Promise<boolean> {
  if (!isUuid(chatId) || !isUuid(expectedMessageId)) return false;

  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ id: schema.chatMessages.id, role: schema.chatMessages.role })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId))
      .orderBy(desc(schema.chatMessages.createdAt))
      .limit(1);
    if (!last || last.role !== "assistant" || last.id !== expectedMessageId) {
      return false;
    }

    const deleted = await tx
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.id, last.id))
      .returning({ id: schema.chatMessages.id });
    return deleted.length > 0;
  });
}

export type RollbackInfo = {
  /** Text of the deleted user message, for refilling the composer. */
  userContent: string;
  /** Storage paths of the attachments that were linked to it. */
  attachmentPaths: string[];
  /** How many message rows were removed in total. */
  deletedMessages: number;
};

/**
 * In one transaction, delete the chat's last user message along with
 * every assistant message that followed it. Attachment ROWS linked to
 * the user message are removed by the FK cascade; their storage paths
 * are captured first and returned so the caller can clear the bucket.
 * Returns null when the chat holds no user message. Not owner-scoped:
 * callers must verify ownership first.
 */
export async function rollbackLastUserMessage(
  chatId: string,
): Promise<RollbackInfo | null> {
  if (!isUuid(chatId)) return null;

  return db.transaction(async (tx) => {
    const [lastUser] = await tx
      .select()
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.chatId, chatId),
          eq(schema.chatMessages.role, "user"),
        ),
      )
      .orderBy(desc(schema.chatMessages.createdAt))
      .limit(1);
    if (!lastUser) return null;

    // Capture storage paths before the rows cascade away with the message.
    const linked = await tx
      .select({ storagePath: schema.chatAttachments.storagePath })
      .from(schema.chatAttachments)
      .where(eq(schema.chatAttachments.messageId, lastUser.id));

    // The user message goes, along with every assistant message from the
    // same moment on (its reply, plus any regenerated replies after it).
    const deleted = await tx
      .delete(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.chatId, chatId),
          or(
            eq(schema.chatMessages.id, lastUser.id),
            and(
              eq(schema.chatMessages.role, "assistant"),
              gte(schema.chatMessages.createdAt, lastUser.createdAt),
            ),
          ),
        ),
      )
      .returning({ id: schema.chatMessages.id });

    return {
      userContent: lastUser.content,
      attachmentPaths: linked.map((r) => r.storagePath),
      deletedMessages: deleted.length,
    };
  });
}

/**
 * Set the chat title only while it still holds the DB default ("New
 * chat"). Used to auto-name a chat from its first message without
 * clobbering a title the user set themselves.
 */
export async function setChatTitleIfDefault(
  chatId: string,
  title: string,
): Promise<void> {
  if (!isUuid(chatId)) return;

  const cleaned = title.trim().slice(0, 80);

  await db
    .update(schema.chats)
    .set({ title: cleaned })
    .where(
      and(eq(schema.chats.id, chatId), eq(schema.chats.title, "New chat")),
    );
}
