import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { basicInfoSchema } from "@/lib/validation/worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:basic");

/** `PATCH /api/worker/profile/basic` — step 1: name, gender, DOB, zones. */
export async function PATCH(req: NextRequest) {
  const parsed = basicInfoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid basic info", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/worker/profile/basic", { method: "PATCH", body: parsed.data });
}
