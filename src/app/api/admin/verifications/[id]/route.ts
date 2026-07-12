import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";
import { verificationDecisionSchema } from "@/lib/validation/admin";

/**
 * `GET /api/admin/verifications/:id?type=worker|business` — one profile under
 * review with its full KYC document URLs.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "worker" && type !== "business") {
    return NextResponse.json({ success: false, message: "Unknown profile type" }, { status: 422 });
  }
  return proxyAdmin(req, `/admin/verifications/${encodeURIComponent(id)}?type=${type}`, {
    method: "GET",
  });
}

/**
 * `PATCH /api/admin/verifications/:id` — approve or reject a KYC profile. A
 * rejection must carry a note; the schema enforces it before the call goes out.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = verificationDecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAdmin(req, `/admin/verifications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: parsed.data,
  });
}
