import { NextResponse } from "next/server";

import { backend } from "@/lib/server/backend";
import { createLogger } from "@/lib/logger";
import { phoneSchema } from "@/lib/validation/auth";

const log = createLogger("auth:send-otp");

/**
 * `POST /api/auth/send-otp` — BFF wrapper over the backend `POST /auth/send-otp`.
 *
 * Validates the phone with {@link phoneSchema} before proxying, so malformed
 * input never reaches (or counts against the rate limit of) the backend.
 *
 * @param req - Expects JSON body `{ phone: string }` in `+8801XXXXXXXXX` form.
 * @returns The backend envelope, or `422` when the phone fails validation.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = phoneSchema.safeParse(json?.phone);
  if (!parsed.success) {
    log.warn("rejected invalid phone");
    return NextResponse.json(
      { success: false, message: "Enter a valid BD number (+8801XXXXXXXXX)" },
      { status: 422 },
    );
  }

  const result = await backend("/auth/send-otp", {
    method: "POST",
    body: { phone: parsed.data },
  });

  log.info("otp dispatch", { phone: parsed.data, status: result.status });
  return NextResponse.json(result.body, { status: result.status });
}
