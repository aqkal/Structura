import { redirect } from "next/navigation";

import { ShellContent } from "@/components/shell/app-shell";
import { SessionSidebar } from "@/components/shell/session-sidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/session/new");

  return (
    <ShellContent sidebar={<SessionSidebar userId={user.id} />}>
      {children}
    </ShellContent>
  );
}
