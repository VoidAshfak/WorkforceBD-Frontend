import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend, type BackendResult } from "@/lib/server/backend";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  clearAdminCookies,
  isIdleStampValid,
  setAdminCookies,
  touchIdleStamp,
} from "@/lib/server/adminCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-session");

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** A dead admin session: cookies wiped, client bounced to the login screen. */
function dead(message: string): NextResponse {
  const res = NextResponse.json({ success: false, message }, { status: 401 });
  clearAdminCookies(res);
  return res;
}

/**
 * Proxies a backend call on behalf of the **admin** session.
 *
 * Every admin request passes three gates before it reaches the backend:
 * 1. the httpOnly admin cookies exist (browser-session scoped — a browser close
 *    drops them),
 * 2. the HMAC-signed idle stamp is present, untampered, and unexpired,
 * 3. the backend still accepts the token (with one transparent refresh).
 *
 * On success the idle deadline slides forward. Any failure clears the cookies,
 * so a dead session can never linger client-side.
 *
 * The browser never sees a token: it lives only in the httpOnly cookie and is
 * injected here, server-side.
 */
export async function proxyAdmin(
  req: NextRequest,
  path: string,
  opts: { method?: Method; body?: unknown } = {},
): Promise<NextResponse> {
  const access = req.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (!access && !refresh) return dead("Not authenticated");
  if (!isIdleStampValid(req)) {
    log.info("admin session idled out", { path });
    return dead("Session timed out. Sign in again.");
  }

  let result: BackendResult<unknown> = access
    ? await backend(path, { ...opts, accessToken: access })
    : ({ ok: false, status: 401, body: {} } as BackendResult<unknown>);

  let rotated: { accessToken: string; refreshToken: string } | undefined;

  if (!result.ok && result.status === 401 && refresh) {
    const refreshed = await backend<{ data: { accessToken: string; refreshToken: string } }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refresh } },
    );
    if (!refreshed.ok) {
      log.info("admin refresh rejected", { status: refreshed.status });
      return dead("Session expired. Sign in again.");
    }
    rotated = refreshed.body.data;
    result = await backend(path, { ...opts, accessToken: rotated.accessToken });
  }

  // The backend rejects a non-admin token on these routes; treat it as a dead
  // session rather than surfacing a confusing 403 inside the dashboard.
  if (result.status === 403) return dead("This account is not an admin.");

  const res = NextResponse.json(result.body, { status: result.status });
  if (rotated) setAdminCookies(res, rotated.accessToken, rotated.refreshToken);
  else touchIdleStamp(res);
  return res;
}
