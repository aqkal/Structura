import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit reads this for generate/migrate/studio.
 *
 * Use DIRECT_URL (Supabase direct connection) for migrations. the pooler
 * doesn't support DDL with prepared-statement caching disabled the way
 * drizzle-kit expects.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
