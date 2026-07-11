import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `GET /api/business/shifts/:id/roster` — live-attendance roster for an owned
 * shift, including the rotating on-site check-in code (~30 s TTL; the client
 * re-fetches to keep the QR fresh). The shift secret never leaves the backend.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}/roster`, { method: "GET" });
}
