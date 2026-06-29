import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { businessProfileSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:profile");

/** `GET /api/business/profile` — the caller's business profile (`404` if none). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/business/profile", { method: "GET" });
}

/**
 * `POST /api/business/profile` — onboarding step 1, creates the business profile.
 * The backend returns `409` if one already exists; that message is forwarded
 * as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = businessProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid business profile", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/profile", { method: "POST", body: parsed.data });
}
