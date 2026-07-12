import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { adminLoginSchema } from "@/lib/validation/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-login");

/**
 * `POST /api/admin/auth/login` — step 1 of the admin sign-in.
 *
 * Forwards username + password to the backend, which mails a 6-digit code. No
 * token is issued here and no cookie is set: the session only begins after the
 * 2FA step. Credentials are never logged.
 */
export async function POST(req: NextRequest) {
  const parsed = adminLoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid credentials" },
      { status: 422 },
    );
  }

  const result = await backend("/auth/admin/login", { method: "POST", body: parsed.data });
  log.info("admin login attempt", { status: result.status });

  return NextResponse.json(result.body, { status: result.status });
}
