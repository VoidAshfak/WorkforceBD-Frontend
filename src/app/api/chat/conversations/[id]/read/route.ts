import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `PATCH /api/chat/conversations/:id/read` — mark all incoming messages read.
 * Idempotent; emits `chat:read` to the counterpart.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/chat/conversations/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}
