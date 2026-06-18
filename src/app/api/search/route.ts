import type { NextRequest } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { apiError } from "@/lib/server/api-error";
import { logEvent } from "@/lib/server/audit";
import { checkCustomLimit } from "@/lib/server/rate-limit";

const SEARCHES_PER_MINUTE = 60;

const MATCH_LIMIT = 8;

const RECENT_LIMIT = 5;

const searchInput = z.object({
  q: z.string().max(200),
});

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "unauthorized");

  const limit = await checkCustomLimit(
    `search:${user.id}`,
    SEARCHES_PER_MINUTE,
  );
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

  logEvent("palette_search", {
    hasQuery,
    sessions: sessionRows.length,
    chats: chatRows.length,
  });

  return Response.json({ sessions: sessionRows, chats: chatRows });
}
