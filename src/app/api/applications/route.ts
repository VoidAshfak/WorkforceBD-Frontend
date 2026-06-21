import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("applications");

const applySchema = z.object({
  shift_id: z.string().min(1),
  note: z.string().max(500).optional(),
});

/**
 * `POST /api/applications` — apply to a shift. The backend additionally requires
 * an admin-verified worker profile and returns `403` otherwise; that message is
 * forwarded to the client as-is.
 */
export async function POST(req: NextRequest) {
  const parsed = applySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid application", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/applications", { method: "POST", body: parsed.data });
}
