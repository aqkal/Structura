import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listAttachmentsForChat } from "@/lib/server/attachments";
import { getChatWithMessages } from "@/lib/server/chats";

import { ChatView, type ChatAttachment, type ChatMessage } from "./chat-view";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId?: string[] }>;
}) {
  const { chatId } = await params;
  if (chatId && chatId.length > 1) notFound();
  const id = chatId?.[0];

  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  if (!id) {
    return (
      <ChatView
        key="new"
        initial={{ chatId: null, messages: [] }}
        userId={user.id}
        userName={user.name}
      />
    );
  }

  const data = await getChatWithMessages(id, user.id);
  if (!data) notFound();

  const attachments = await listAttachmentsForChat(id);
  const byMessage = new Map<string, ChatAttachment[]>();
  for (const att of attachments) {
    if (!att.messageId) continue;
    const list = byMessage.get(att.messageId) ?? [];
    list.push({
      id: att.id,
      mediaType: att.mediaType,
      fileName: att.fileName,
    });
    byMessage.set(att.messageId, list);
  }

  const messages: ChatMessage[] = data.messages.map((m) => {
    const linked = byMessage.get(m.id);
    return {
      role: m.role,
      content: m.content,
      ...(linked && linked.length > 0 ? { attachments: linked } : {}),
    };
  });

  return (
    <ChatView
      key={id}
      initial={{ chatId: id, messages }}
      userId={user.id}
      userName={user.name}
    />
  );
}
