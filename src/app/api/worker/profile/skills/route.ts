import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { skillsSchema } from "@/lib/validation/worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:skills");

/** `PATCH /api/worker/profile/skills` — step 2: replaces the worker's skills. */
export async function PATCH(req: NextRequest) {
  const parsed = skillsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid skills", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/worker/profile/skills", { method: "PATCH", body: parsed.data });
}
