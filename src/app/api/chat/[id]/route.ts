import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { guardChat } from "@/lib/server/chat-guard";
import { deleteChat, renameChat } from "@/lib/server/chats";

const renameInput = z.object({
  title: z.string().trim().min(1).max(80),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;

  return Response.json({ id: guard.chat.id, title: guard.chat.title });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;

  const raw: unknown = await req.json().catch(() => null);
  const parsed = renameInput.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return apiError(400, "bad_request", message);
  }

  const renamed = await renameChat(id, guard.user.id, parsed.data.title);
  if (!renamed) return apiError(404, "not_found");

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const guard = await guardChat(id);
  if (!guard.ok) return guard.response;

  const deleted = await deleteChat(id, guard.user.id);
  if (!deleted) return apiError(404, "not_found");

  return Response.json({ ok: true });
}
