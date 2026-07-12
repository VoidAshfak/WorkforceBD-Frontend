import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** Whitelisted query params forwarded to `GET /admin/shifts`. */
const ALLOWED = ["status", "page", "limit"] as const;

/** `GET /api/admin/shifts` — shift-post moderation queue (default `pending_approval`). */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAdmin(req, `/admin/shifts${query ? `?${query}` : ""}`, { method: "GET" });
}
