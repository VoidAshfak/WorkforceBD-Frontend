import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { settingUpdateSchema } from "@/lib/validation/admin";

/** Only the keys the backend documents as tunable can be addressed at all. */
const TUNABLE = new Set([
  "PLATFORM_FEE_PERCENT",
  "HANDSHAKE_AUTO_CONFIRM_HOURS",
  "CHECKIN_RADIUS_METERS",
  "CHECKIN_GRACE_MINUTES",
  "CHECKIN_MAX_ACCURACY_METERS",
  "BUSINESS_WALLET_SEED_BALANCE",
  "MIN_BUSINESS_TOPUP",
  "LARGE_REQUEST_WORKER_THRESHOLD",
  "CANCEL_FREE_NOTICE_HOURS",
  "PENALTY_MIN_RATE",
  "PENALTY_MAX_RATE",
  "PENALTY_TIMING_MIN_RATE",
  "PENALTY_TIMING_MAX_RATE",
  "PENALTY_INSTANT_BASE",
  "PENALTY_FACTOR_WEIGHT",
]);

function guard(key: string): NextResponse | null {
  if (!TUNABLE.has(key)) {
    return NextResponse.json(
      { success: false, message: `Unknown platform setting: ${key}` },
      { status: 422 },
    );
  }
  return null;
}

/**
 * `PATCH /api/admin/settings/:key` — override one constant. Live within ≤ 60 s
 * across instances, no redeploy. Bounds (`min`/`max`) are enforced by the backend.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const bad = guard(key);
  if (bad) return bad;

  const parsed = settingUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAdmin(req, `/admin/settings/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: parsed.data,
  });
}

/** `DELETE /api/admin/settings/:key` — drop the override, revert to the compiled default. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const bad = guard(key);
  if (bad) return bad;

  return proxyAdmin(req, `/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
}
