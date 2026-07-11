import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { disputeSchema } from "@/lib/validation/engagement";
import { createLogger } from "@/lib/logger";

const log = createLogger("disputes");

/** Whitelisted query params forwarded to `GET /disputes/my`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/disputes` — the caller's disputes (raised or against), newest first.
 * Party-based: proxies the backend's `/disputes/my`.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/disputes/my${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * `POST /api/disputes` — raise a dispute on an assignment the caller is a party
 * to. Freezes the assignment's handshake until an admin rules. The backend
 * additionally enforces party membership + assignment state, returning
 * `403`/`404`/`409`; those messages are forwarded as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = disputeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid dispute", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/disputes", { method: "POST", body: parsed.data });
}
