import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { createShiftSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:shifts");

/** Whitelisted query params forwarded to the backend `GET /business/shifts`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/business/shifts` — the business's own shifts, newest first. Only
 * known query params are forwarded so the backend's validator never sees
 * unexpected input.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/business/shifts${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * `POST /api/business/shifts` — create a shift (submits for admin review unless
 * `draft: true`). Submitting escrows the shift cost; the backend returns `402`
 * on an underfunded wallet and `404` if no business profile exists yet — those
 * messages are forwarded to the client as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = createShiftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid shift", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/shifts", { method: "POST", body: parsed.data });
}
