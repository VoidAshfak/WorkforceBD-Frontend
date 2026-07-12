import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** `GET /api/admin/users/:id` — profiles, wallet snapshot, and sanction history. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxyAdmin(req, `/admin/users/${encodeURIComponent(id)}`, { method: "GET" });
}
