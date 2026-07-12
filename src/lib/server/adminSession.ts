import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend, readSetCookie, type BackendResult } from "@/lib/server/backend";
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  BACKEND_ADMIN_REFRESH_COOKIE,
  adminRefreshCookieHeader,
  clearAdminCookies,
  setAdminCookies,
} from "@/lib/server/adminCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-session");

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Rotated = { accessToken: string; refreshToken: string };

/**
 * In-flight refreshes, keyed by the refresh token being spent.
 *
 * Refresh tokens are **single-use**: the backend rotates them and rejects the old
 * one. The admin access token lives only 5 minutes, so a page load easily fires
 * several admin calls that all expire together — without this, each would spend
 * the same refresh token, exactly one would win, and the losers would look like a
 * dead session and log the admin out. Sharing one rotation per token fixes that:
 * the first caller performs it, the rest await the same promise and re-store the
 * same rotated pair.
 */
const inFlight = new Map<string, Promise<Rotated | null>>();

/**
 * How long a completed rotation stays cached against the token it spent. A
 * request the browser sent *before* the new cookie landed still carries the old
 * token; it must be handed the already-rotated pair rather than re-spending a
 * token the backend has now burned.
 */
const ROTATION_GRACE_MS = 30_000;

function rotate(refreshToken: string): Promise<Rotated | null> {
  const existing = inFlight.get(refreshToken);
  if (existing) return existing;

  const pending = (async (): Promise<Rotated | null> => {
    // The admin refresh flow is cookie-driven: empty body, token in the `Cookie`
    // header. The response carries only the new access token — the rotated refresh
    // token comes back as a `Set-Cookie`, which lands here because the BFF, not the
    // browser, is the backend's client.
    const res = await backend<{ data: { accessToken: string } }>("/auth/refresh", {
      method: "POST",
      body: {},
      cookie: adminRefreshCookieHeader(refreshToken),
    });
    if (!res.ok) {
      // Includes `401 Session expired due to inactivity` — the backend's own
      // 10-minute idle deadline, which also revokes the session.
      log.info("admin refresh rejected", { status: res.status });
      return null;
    }

    const accessToken = res.body.data?.accessToken;
    if (!accessToken) {
      log.error("admin refresh returned no access token");
      return null;
    }

    // A rotation that doesn't re-set the cookie means the backend kept the token in
    // play. Reusing a token it *had* rotated would trip reuse detection and kill the
    // session, so only fall back when it sent nothing new.
    const rotatedRefresh = readSetCookie(res.setCookie, BACKEND_ADMIN_REFRESH_COOKIE);
    return { accessToken, refreshToken: rotatedRefresh ?? refreshToken };
  })();

  inFlight.set(refreshToken, pending);

  void pending.then((result) => {
    if (!result) {
      // A dead session shouldn't be cached — the next call must ask again.
      inFlight.delete(refreshToken);
      return;
    }
    const timer = setTimeout(() => inFlight.delete(refreshToken), ROTATION_GRACE_MS);
    // Don't hold the process open for a cache entry.
    timer.unref?.();
  });

  return pending;
}

/** A dead admin session: cookies wiped, client bounced to the login screen. */
function dead(message: string): NextResponse {
  const res = NextResponse.json({ success: false, message }, { status: 401 });
  clearAdminCookies(res);
  return res;
}

/**
 * Proxies a backend call on behalf of the **admin** session.
 *
 * The token lives only in an httpOnly, browser-session cookie and is injected
 * here — the browser never sees it. A `401` from the backend triggers one shared
 * refresh (see {@link rotate}); if that refresh is itself rejected the session is
 * over (expired, revoked, or past the backend's 10-minute idle deadline) and the
 * cookies are cleared so nothing stale lingers client-side.
 */
export async function proxyAdmin(
  req: NextRequest,
  path: string,
  opts: { method?: Method; body?: unknown } = {},
): Promise<NextResponse> {
  const access = req.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;

  if (!access && !refresh) return dead("Not authenticated");

  let result: BackendResult<unknown> = access
    ? await backend(path, { ...opts, accessToken: access })
    : ({ ok: false, status: 401, body: {}, setCookie: [] } as BackendResult<unknown>);

  let rotated: Rotated | undefined;

  if (!result.ok && result.status === 401 && refresh) {
    const fresh = await rotate(refresh);
    if (!fresh) return dead("Session expired. Sign in again.");

    rotated = fresh;
    result = await backend(path, { ...opts, accessToken: fresh.accessToken });
  }

  // The backend rejects a non-admin token on these routes; treat it as a dead
  // session rather than surfacing a confusing 403 inside the dashboard.
  if (result.status === 403) return dead("This account is not an admin.");

  const res = NextResponse.json(result.body, { status: result.status });
  if (rotated) setAdminCookies(res, rotated.accessToken, rotated.refreshToken);
  return res;
}
