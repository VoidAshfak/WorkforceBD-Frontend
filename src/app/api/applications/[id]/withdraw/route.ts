import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `PATCH /api/applications/:id/withdraw` — pull out of an application. The
 * backend allows this only while `pending`/`shortlisted` and returns `409`
 * otherwise; that message is forwarded to the client as-is.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/applications/${encodeURIComponent(id)}/withdraw`, { method: "PATCH" });
}
