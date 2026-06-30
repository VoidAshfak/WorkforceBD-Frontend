import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { businessDocumentsSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:profile:documents");

/**
 * `PATCH /api/business/profile/documents` — submits verification documents and
 * moves `verification_status` to `pending`. At least one of `trade_license_url`
 * / `business_doc_url` is required; the backend's `400`/`403` messages are
 * forwarded as-is.
 */
export async function PATCH(req: NextRequest) {
  const parsed = businessDocumentsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid documents", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/profile/documents", { method: "PATCH", body: parsed.data });
}
