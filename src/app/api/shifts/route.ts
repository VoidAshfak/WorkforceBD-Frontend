import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** Whitelisted discovery query params forwarded to the backend `GET /shifts`. */
const ALLOWED = ["filter", "zone_id", "category_id", "page", "limit"] as const;

/**
 * `GET /api/shifts` — paginated, filtered shift discovery feed. Only known query
 * params are forwarded; anything else is dropped so the backend's validator
 * never sees unexpected input.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/shifts${query ? `?${query}` : ""}`, { method: "GET" });
}
