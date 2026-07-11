import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { ratingSchema } from "@/lib/validation/engagement";
import { createLogger } from "@/lib/logger";

const log = createLogger("ratings");

/** Whitelisted query params forwarded to `GET /ratings/my`. */
const ALLOWED = ["direction", "page", "limit"] as const;

/**
 * `GET /api/ratings` — the caller's ratings (`received` default, or `given`)
 * plus their received summary. Proxies the backend's `/ratings/my`.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/ratings/my${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * `POST /api/ratings` — rate the other party on a completed assignment. The
 * backend enforces party membership, handshake completion, and one-per-direction
 * uniqueness, returning `403`/`404`/`409`; those messages are forwarded as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = ratingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid rating", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/ratings", { method: "POST", body: parsed.data });
}
