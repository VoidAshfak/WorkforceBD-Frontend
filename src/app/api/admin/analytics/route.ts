import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/**
 * `GET /api/admin/analytics` — daily, zero-filled time series for the graphs.
 * `days` is clamped to the backend's 7–90 window here so a hand-crafted query
 * can't push it out of range.
 */
export async function GET(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw) ? Math.min(90, Math.max(7, Math.trunc(raw))) : 30;
  return proxyAdmin(req, `/admin/analytics?days=${days}`, { method: "GET" });
}
