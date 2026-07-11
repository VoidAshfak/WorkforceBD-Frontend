import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `POST /api/applications/:id/confirm-checkout` — worker confirms a
 * business-stamped check-out (`business_done` → `confirmed`), completing the
 * handshake and releasing payment immediately. Backend `409`s when nothing is
 * waiting for confirmation or the assignment is disputed; forwarded as-is.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/applications/${encodeURIComponent(id)}/confirm-checkout`, {
    method: "POST",
  });
}
