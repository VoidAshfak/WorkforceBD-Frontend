import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * The only handshake actions the backend exposes on a roster assignment:
 * `checkout` stamps a forgotten check-out (opens the worker's confirm window),
 * `confirm` pays the worker and releases the escrow slice, `no-show` marks an
 * absentee and returns the slice.
 */
const ACTIONS = new Set(["checkout", "confirm", "no-show"]);

/**
 * `POST /api/business/assignments/:id/:action` — completion-handshake action on
 * an owned shift's assignment. The action is path-whitelisted so only valid
 * verbs reach the backend; its `404`/`409` messages pass through.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await ctx.params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 404 });
  }
  return proxyAuthed(req, `/business/assignments/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
  });
}
