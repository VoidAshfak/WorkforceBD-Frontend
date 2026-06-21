import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** Whitelisted query params forwarded to the backend `GET /notifications`. */
const ALLOWED = ["unread", "page", "limit"] as const;

/**
 * `GET /api/notifications` — paginated notification feed for the session user,
 * newest first. Only known query params are forwarded.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/notifications${query ? `?${query}` : ""}`, { method: "GET" });
}
