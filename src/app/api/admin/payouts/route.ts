import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** Whitelisted query params forwarded to `GET /payments/admin/payouts`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/admin/payouts` — payout queue for disbursement (default `pending`),
 * oldest-waiting first. Account numbers come back in full here — the admin needs
 * them to actually send the money — so the response is never cached.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAdmin(req, `/payments/admin/payouts${query ? `?${query}` : ""}`, { method: "GET" });
}
