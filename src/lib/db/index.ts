import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __structuraDbClient: ReturnType<typeof postgres> | undefined;
}

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
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__structuraDbClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
