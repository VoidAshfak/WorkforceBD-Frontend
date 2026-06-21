import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `PATCH /api/notifications/:id/read` — mark a single owned notification read
 * (idempotent). The backend returns `404` for a missing/unowned id.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}
