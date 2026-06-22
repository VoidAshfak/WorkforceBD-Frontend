import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("applications:check-in");

const checkInSchema = z
  .object({
    method: z.enum(["gps", "qr", "manual"]),
    coordinates: z
      .object({ latitude: z.number(), longitude: z.number() })
      .optional(),
    qr_token: z.string().min(1).optional(),
  })
  .refine((v) => v.method !== "gps" || v.coordinates, {
    message: "coordinates are required for GPS check-in",
  })
  .refine((v) => v.method !== "qr" || v.qr_token, {
    message: "qr_token is required for QR check-in",
  });

/**
 * `POST /api/applications/:id/check-in` — live attendance check-in for an
 * accepted shift. Backend enforces the geofence/QR/time-window rules and
 * returns `409`/`422` with a human message that is forwarded as-is.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = checkInSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid check-in", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, `/applications/${encodeURIComponent(id)}/check-in`, {
    method: "POST",
    body: parsed.data,
  });
}
