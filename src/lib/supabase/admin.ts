import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client factory.
 *
 * This is the single sanctioned admin-job use of the service-role key per
 * SECURITY.md: account deletion (purging the user's storage folder and
 * removing the auth user) in src/app/api/account/delete/route.ts. That
 * route is its only consumer.
 *
 * The service-role key bypasses RLS entirely, so:
 * - This module must NEVER be imported by client components. The
 *   "server-only" import above makes any such attempt a build error.
 * - Do not reach for this for normal reads/writes; all regular storage and
 *   DB access goes through the signed-in user's own session so RLS keeps
 *   doing its job.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    // Names only; never echo env values.
    throw new Error("admin_client_env_missing");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // This client is a stateless server-side tool. It must never persist
      // or refresh a session of its own.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
