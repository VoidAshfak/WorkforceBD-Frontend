import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/shifts/:id` — single shift detail (richer business trust info). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/shifts/${encodeURIComponent(id)}`, { method: "GET" });
}
