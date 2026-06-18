import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";

export type ChatRow = typeof schema.chats.$inferSelect;
export type ChatMessageRow = typeof schema.chatMessages.$inferSelect;

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
  userContent: string;

  attachmentPaths: string[];

  deletedMessages: number;
};

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

    const linked = await tx
      .select({ storagePath: schema.chatAttachments.storagePath })
      .from(schema.chatAttachments)
      .where(eq(schema.chatAttachments.messageId, lastUser.id));

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
