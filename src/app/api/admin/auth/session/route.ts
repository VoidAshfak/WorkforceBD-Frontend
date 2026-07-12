import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/**
 * `GET /api/admin/auth/session` — who is signed in, if anyone.
 *
 * The dashboard shell calls this on mount. A `401` (no cookies, idled out, or a
 * dead token) means "show the login screen"; anything else returns the admin.
 * Calling it also slides the inactivity deadline forward, so it doubles as the
 * heartbeat for an active tab.
 */
export async function GET(req: NextRequest) {
  return proxyAdmin(req, "/auth/me", { method: "GET" });
}
