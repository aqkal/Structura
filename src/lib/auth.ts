import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Returns the signed-in user, or null if no session.
 * Never throws. Pages should be able to call this and render either state.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email ?? "",
      name:
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
    };
  } catch {
    return null;
  }
}
