import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { businessPreferencesSchema } from "@/lib/validation/business";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:profile:preferences");

/** `PATCH /api/business/profile/preferences` — onboarding step 3, perk toggles. */
export async function PATCH(req: NextRequest) {
  const parsed = businessPreferencesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid preferences", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/business/profile/preferences", { method: "PATCH", body: parsed.data });
}
