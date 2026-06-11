import { ShellContent } from "@/components/shell/app-shell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellContent>{children}</ShellContent>;
}
