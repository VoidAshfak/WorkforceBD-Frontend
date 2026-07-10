import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { topupSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:wallet");

/**
 * `POST /api/business/wallet/topup` — add spendable funds. Placeholder funding
 * (credited instantly, no external capture). The backend requires an
 * admin-verified business and returns `403`/`400`/`404` otherwise; those
 * messages are forwarded to the client as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = topupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid topup", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/wallet/topup", { method: "POST", body: parsed.data });
}
