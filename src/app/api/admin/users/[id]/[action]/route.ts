import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { blockUserSchema, unblockUserSchema } from "@/lib/validation/admin";

/**
 * `POST /api/admin/users/:id/block|unblock` — platform-wide sanction actions.
 *
 * Blocking deactivates the account, records a `ban` sanction, and revokes every
 * live session; unblocking reactivates and closes open sanctions. The action is
 * path-whitelisted, and each carries its own body schema (a block needs a
 * reason, an unblock takes an optional note).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await ctx.params;
  if (action !== "block" && action !== "unblock") {
    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 404 });
  }

  const schema = action === "block" ? blockUserSchema : unblockUserSchema;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }

  return proxyAdmin(req, `/admin/users/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    body: parsed.data,
  });
}
