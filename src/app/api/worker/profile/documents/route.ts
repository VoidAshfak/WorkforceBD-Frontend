import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { documentsSchema } from "@/lib/validation/worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:documents");

/**
 * `PATCH /api/worker/profile/documents` — step 4: submits KYC document URLs and
 * flips verification to `pending`. URLs are produced by the Cloudinary upload
 * flow on the client; only the resulting URLs pass through here.
 */
export async function PATCH(req: NextRequest) {
  const parsed = documentsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid documents", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/worker/profile/documents", { method: "PATCH", body: parsed.data });
}
