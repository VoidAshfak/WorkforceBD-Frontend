import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { ADMIN_REFRESH_COOKIE, clearAdminCookies } from "@/lib/server/adminCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-logout");

/**
 * `POST /api/admin/auth/logout` — revokes the refresh token server-side and
 * wipes the admin cookies. Cookies are cleared even when the backend call fails,
 * so the browser is never left holding a session the server has forgotten.
 */
export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (refresh) {
    const result = await backend("/auth/logout", {
      method: "POST",
      body: { refresh_token: refresh },
    });
    log.info("admin logout", { status: result.status });
  }

  const res = NextResponse.json({ success: true, message: "Signed out" }, { status: 200 });
  clearAdminCookies(res);
  return res;
}
