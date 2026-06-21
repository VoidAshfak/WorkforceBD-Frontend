import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { availabilitySchema } from "@/lib/validation/worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:availability");

/** `PATCH /api/worker/profile/availability` — step 3: days, slots, zones. */
export async function PATCH(req: NextRequest) {
  const parsed = availabilitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid availability", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/worker/profile/availability", { method: "PATCH", body: parsed.data });
}
