import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `POST /api/payments/shifts/:id/settle` — confirm-everything shortcut over the
 * completion handshake: closes every still-open assignment on a `completed` (or
 * `payment_pending`) owned shift. Idempotent per assignment; disputed slices are
 * left frozen for the admin. Backend `409`/`400` messages pass through.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/payments/shifts/${encodeURIComponent(id)}/settle`, { method: "POST" });
}
