import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { SettingsView } from "./settings-view";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  return <SettingsView name={user.name} email={user.email} />;
}
