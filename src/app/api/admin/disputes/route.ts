import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** Whitelisted query params forwarded to `GET /disputes/admin`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/admin/disputes` — the admin dispute queue (default `open`),
 * oldest-waiting first. Each item carries the frozen assignment and both parties.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAdmin(req, `/disputes/admin${query ? `?${query}` : ""}`, { method: "GET" });
}
