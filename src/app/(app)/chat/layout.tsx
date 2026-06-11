import { redirect } from "next/navigation";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ShellContent } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/chat");

  return (
    <ShellContent sidebar={<ChatSidebar userId={user.id} />}>
      {children}
    </ShellContent>
  );
}
