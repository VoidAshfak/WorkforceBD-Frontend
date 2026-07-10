import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { payoutSchema } from "@/lib/validation/payments";
import { createLogger } from "@/lib/logger";

const log = createLogger("payments:payouts");

/** Whitelisted query params forwarded to `GET /payments/payouts`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/payments/payouts` — the worker's own withdrawal requests, newest
 * first. Account numbers arrive masked from the backend.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/payments/payouts${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * `POST /api/payments/payouts` — request a withdrawal. The backend additionally
 * requires an admin-verified worker and enough balance, returning `403`/`400`
 * otherwise; those messages are forwarded to the client as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = payoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid payout", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/payments/payouts", { method: "POST", body: parsed.data });
}
