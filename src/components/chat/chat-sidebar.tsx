import { listChats } from "@/lib/server/chats";

import { ChatSidebarList, type SidebarChat } from "./chat-sidebar-list";

type ChatSidebarProps = {
  userId: string;
};

export async function ChatSidebar({ userId }: ChatSidebarProps) {
  const chats = await listChats(userId, 50);

  const serialized: SidebarChat[] = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt.toISOString(),
  }));

  return <ChatSidebarList chats={serialized} />;
}
