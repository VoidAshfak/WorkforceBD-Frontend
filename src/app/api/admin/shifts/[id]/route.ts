import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { shiftDecisionSchema } from "@/lib/validation/admin";

/**
 * `PATCH /api/admin/shifts/:id` — approve a shift post (→ `published`, visible to
 * workers) or reject it (→ `draft`, escrow refunded to the business in the same
 * transaction). Rejections require a note.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = shiftDecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAdmin(req, `/admin/shifts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: parsed.data,
  });
}
