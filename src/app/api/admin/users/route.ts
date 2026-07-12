import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** Whitelisted query params forwarded to `GET /admin/users`. */
const ALLOWED = ["role", "status", "search", "page", "limit"] as const;

/** `GET /api/admin/users` — user directory (workers + businesses + admins). */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    // The backend caps `search` at 100 chars — trim here so it never 422s on length.
    if (value) params.set(key, key === "search" ? value.slice(0, 100) : value);
  }
  const query = params.toString();
  return proxyAdmin(req, `/admin/users${query ? `?${query}` : ""}`, { method: "GET" });
}
