import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `POST /api/applications/:id/check-out` — check out of a shift the worker
 * previously checked into. Backend returns `409` if there was no prior check-in
 * or it was already checked out; that message is forwarded as-is.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/applications/${encodeURIComponent(id)}/check-out`, { method: "POST" });
}
