import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** The only applicant decisions the backend exposes. */
const DECISIONS = new Set(["shortlist", "unshortlist", "accept", "reject"]);

/**
 * `PATCH /api/business/applications/:id/:decision` — shortlist / unshortlist /
 * accept / reject an applicant on an owned shift. The decision is
 * path-whitelisted so only valid actions reach the backend; its `404`/`409`
 * messages pass through.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; decision: string }> },
) {
  const { id, decision } = await ctx.params;
  if (!DECISIONS.has(decision)) {
    return NextResponse.json({ success: false, message: "Unknown decision" }, { status: 404 });
  }
  return proxyAuthed(req, `/business/applications/${encodeURIComponent(id)}/${decision}`, {
    method: "PATCH",
  });
}
