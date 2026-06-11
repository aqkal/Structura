import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Next.js 16 requires `cookies()` to be awaited. The `getAll`/`setAll` handlers
 * support async, so we just await inside them.
 *
 * If called from a Server Component, `setAll` may throw because you can't
 * mutate cookies during render. That's expected, the proxy.ts middleware
 * is the canonical place where refreshed tokens get written back.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component. proxy.ts handles refresh.
          }
        },
      },
    },
  );
}
