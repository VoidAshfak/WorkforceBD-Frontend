import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/business/shifts/:id` — single owned-shift detail with counters. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}`, { method: "GET" });
}
