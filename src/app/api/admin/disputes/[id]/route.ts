import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { disputeRulingSchema } from "@/lib/validation/admin";

/**
 * `PATCH /api/admin/disputes/:id` — rule on a dispute. The backend executes the
 * ruling atomically (pays the ruled amount, settles the escrow slice, unfreezes
 * the assignment, notifies both parties, closes the shift if it was the last
 * open handshake), so this is a one-shot, irreversible action.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = disputeRulingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAdmin(req, `/disputes/admin/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: parsed.data,
  });
}
