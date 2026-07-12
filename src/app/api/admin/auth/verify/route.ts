import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { setAdminCookies } from "@/lib/server/adminCookies";
import { adminVerifySchema } from "@/lib/validation/admin";
import { createLogger } from "@/lib/logger";
import type { AdminUser } from "@/types/admin";

const log = createLogger("admin-verify");

type VerifyData = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
  active_role: string;
};

/**
 * `POST /api/admin/auth/verify` — step 2 of the admin sign-in.
 *
 * Exchanges the mailed code for an admin token pair, stores it in httpOnly
 * browser-session cookies, and returns **only** the user object — the tokens are
 * stripped from the response so they never enter JS memory.
 */
export async function POST(req: NextRequest) {
  const parsed = adminVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid code" },
      { status: 422 },
    );
  }

  const result = await backend<{ data: VerifyData }>("/auth/admin/verify-2fa", {
    method: "POST",
    body: parsed.data,
  });

  if (!result.ok) {
    log.info("admin 2FA rejected", { status: result.status });
    return NextResponse.json(result.body, { status: result.status });
  }

  const { accessToken, refreshToken, user } = result.body.data;

  // Defence in depth: the backend already gates this, but never open a dashboard
  // session for a token that isn't actually an admin's.
  if (!user?.roles?.includes("admin")) {
    log.warn("non-admin token returned from admin 2FA");
    return NextResponse.json(
      { success: false, message: "This account is not an admin." },
      { status: 403 },
    );
  }

  log.info("admin session started", { user_id: user.id });

  const res = NextResponse.json(
    { success: true, message: result.body.message ?? "Signed in", data: { user } },
    { status: 200 },
  );
  setAdminCookies(res, accessToken, refreshToken);
  return res;
}
