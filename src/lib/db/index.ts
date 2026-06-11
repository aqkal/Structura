import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __structuraDbClient: ReturnType<typeof postgres> | undefined;
}

/**
 * Server-only Drizzle client backed by postgres.js.
 *
 * Pooler vs direct:
 *   - For app queries use the Supabase **Transaction pooler** URL.
 *     It's compatible with serverless and short-lived connections.
 *   - For migrations (drizzle-kit), use the direct connection string.
 *     The pooler closes prepared statements between transactions which
 *     breaks DDL.
 *
 * We cache the client on globalThis to survive Next.js dev hot-reloads.
 */
const connectionString =
  process.env.DATABASE_URL ??
  (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set");
    }
    return "";
  })();

const client =
  globalThis.__structuraDbClient ??
  postgres(connectionString, {
    prepare: false, // required for Supabase transaction pooler
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__structuraDbClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
