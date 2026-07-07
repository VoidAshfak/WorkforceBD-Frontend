import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:shift");

/** `GET /api/business/shifts/:id` — single owned-shift detail with counters. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}`, { method: "GET" });
}

/** Delete/cancel payload — optional reason, penalty acknowledgement. */
const deleteSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  acknowledge_penalty: z.boolean().optional(),
});

/**
 * `DELETE /api/business/shifts/:id` — delete/cancel an owned shift. Free case
 * refunds escrow; penalty case pays hired workers and needs
 * `acknowledge_penalty: true` (otherwise the backend 409s with the breakdown so
 * the modal can confirm the charge).
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Body is optional (a free delete needs none); default to an empty object.
  const raw = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    log.warn("invalid delete payload", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: parsed.data,
  });
}
