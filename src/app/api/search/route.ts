import type { NextRequest } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";

/** Palette searches a single user may run per minute (debounced client side). */
const SEARCHES_PER_MINUTE = 60;

/** Result rows per kind when a query is present. */
const MATCH_LIMIT = 8;

/** Result rows per kind when the query is empty (recents). */
const RECENT_LIMIT = 5;

const searchInput = z.object({
  q: z.string().max(200),
});

/** Escape LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * GET /api/search?q=
 *
 * Command palette source. Returns the signed-in user's sessions and chats
 * matching the query (case-insensitive substring), ordered by recency.
 * An empty query returns the most recent items of each kind.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = checkCustomLimit(`search:${user.id}`, SEARCHES_PER_MINUTE);
  if (!limit.allowed) {
    return apiError(429, "rate_limited", "Slow down a moment.", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const parsed = searchInput.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid search query.");
  }

  const q = parsed.data.q.trim();
  const hasQuery = q.length > 0;
  const perKind = hasQuery ? MATCH_LIMIT : RECENT_LIMIT;
  const pattern = `%${escapeLike(q)}%`;

  const sessionWhere = hasQuery
    ? and(
        eq(schema.sessions.userId, user.id),
        ilike(schema.sessions.problemText, pattern),
      )
    : eq(schema.sessions.userId, user.id);

  const chatWhere = hasQuery
    ? and(eq(schema.chats.userId, user.id), ilike(schema.chats.title, pattern))
    : eq(schema.chats.userId, user.id);

  const [sessionRows, chatRows] = await Promise.all([
    db
      .select({
        id: schema.sessions.id,
        problem: schema.sessions.problemText,
        subject: schema.sessions.subjectSlug,
        status: schema.sessions.status,
      })
      .from(schema.sessions)
      .where(sessionWhere)
      .orderBy(desc(schema.sessions.startedAt))
      .limit(perKind),
    db
      .select({
        id: schema.chats.id,
        title: schema.chats.title,
      })
      .from(schema.chats)
      .where(chatWhere)
      .orderBy(desc(schema.chats.updatedAt))
      .limit(perKind),
  ]);

  // Counts only, never the query text or matched content.
  logEvent("palette_search", {
    hasQuery,
    sessions: sessionRows.length,
    chats: chatRows.length,
  });

  return Response.json({ sessions: sessionRows, chats: chatRows });
}
