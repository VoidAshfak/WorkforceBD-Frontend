import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { REFRESH_COOKIE, clearAuthCookies } from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth:logout");

/**
 * `POST /api/auth/logout` — ends the session.
 *
 * Best-effort revoke of the refresh token on the backend, then always clears the
 * local auth cookies so the client is logged out even if the revoke call fails.
 *
 * @param req - Carries the httpOnly refresh cookie.
 * @returns `200` once cookies are cleared.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await backend("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }).catch(() => undefined);
  }

  log.info("session cleared");
  const res = NextResponse.json({ success: true, message: "Logged out" });
  clearAuthCookies(res);
  return res;
}
