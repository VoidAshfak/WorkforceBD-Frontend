import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { payoutDecisionSchema } from "@/lib/validation/admin";

/**
 * `PATCH /api/admin/payouts/:id` — mark a pending payout sent (finalizes
 * `total_withdrawn`) or reject it (credits the held amount back to the worker's
 * wallet). Rejections require a reason; the worker is notified either way.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = payoutDecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAdmin(req, `/payments/admin/payouts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: parsed.data,
  });
}
