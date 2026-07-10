import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** Whitelisted query params forwarded to `GET /business/wallet/transactions`. */
const ALLOWED = ["page", "limit"] as const;

/**
 * `GET /api/business/wallet/transactions` — business wallet ledger, newest
 * first. Only known query params are forwarded so the backend validator never
 * sees unexpected input.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/business/wallet/transactions${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}
