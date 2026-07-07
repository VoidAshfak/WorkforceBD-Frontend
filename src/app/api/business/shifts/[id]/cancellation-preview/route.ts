import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `GET /api/business/shifts/:id/cancellation-preview` — dry-run breakdown for the
 * swipe-to-delete modal (free vs. penalty, per-worker compensation). Moves no
 * money; the actual delete goes through `DELETE /api/business/shifts/:id`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}/cancellation-preview`, {
    method: "GET",
  });
}
