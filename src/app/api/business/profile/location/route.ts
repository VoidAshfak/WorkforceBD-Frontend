import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { businessLocationSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:profile:location");

/** `PATCH /api/business/profile/location` — onboarding step 2, saves location. */
export async function PATCH(req: NextRequest) {
  const parsed = businessLocationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid location", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/profile/location", { method: "PATCH", body: parsed.data });
}
