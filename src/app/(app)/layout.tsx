import { ShellFrame } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return <ShellFrame user={user}>{children}</ShellFrame>;
}
