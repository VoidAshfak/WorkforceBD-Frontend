import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend, type BackendResult } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("session");

/** Rotated token pair returned by `/auth/refresh` (both are single-use). */
export type Rotated = { accessToken: string; refreshToken: string };

/**
 * Outcome of an authenticated backend call made on behalf of the session
 * cookies. `ok` carries the backend result plus any rotated tokens that must be
 * re-stored on the outgoing response.
 */
export type AuthedCall<T> =
  | { kind: "ok"; result: BackendResult<T>; rotated?: Rotated }
  | { kind: "no-session" }
  | { kind: "expired" };

/**
 * Calls a protected backend endpoint using the session's access token, with
 * transparent refresh on `401`. Mirrors the logic in `/api/auth/me` so every
 * protected BFF route gets the same single-use token rotation for free.
 *
 * The caller is responsible for re-storing {@link Rotated} tokens on the
 * response (use {@link respondAuthed} or {@link setAuthCookies}).
 *
 * @typeParam T - Expected shape of the response `data`.
 */
export async function callAuthedBackend<T = Record<string, unknown>>(
  req: NextRequest,
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<AuthedCall<T>> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!access && !refresh) return { kind: "no-session" };

  let token = access;
  let rotated: Rotated | undefined;

  let result = token
    ? await backend<T>(path, { ...opts, accessToken: token })
    : ({ ok: false, status: 401, body: {} as never } as BackendResult<T>);

  if (!result.ok && result.status === 401 && refresh) {
    log.debug("access token rejected, refreshing", { path });
    const refreshed = await backend<{ data: Rotated }>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refresh },
    });
    if (!refreshed.ok) {
      log.info("refresh failed", { status: refreshed.status });
      return { kind: "expired" };
    }
    rotated = refreshed.body.data;
    token = rotated.accessToken;
    result = await backend<T>(path, { ...opts, accessToken: token });
  }

  return { kind: "ok", result, rotated };
}

/**
 * Proxies a single protected backend call and returns a ready `NextResponse`,
 * forwarding the backend envelope verbatim and rotating session cookies when
 * the access token was refreshed mid-flight. Dead sessions clear cookies → 401.
 *
 * @param req - Carries the httpOnly auth cookies.
 * @param path - Backend path, e.g. `"/worker/profile/basic"`.
 * @param opts - HTTP method and optional JSON body.
 */
export async function proxyAuthed(
  req: NextRequest,
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<NextResponse> {
  const call = await callAuthedBackend(req, path, opts);

  if (call.kind === "no-session") {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }
  if (call.kind === "expired") {
    const res = NextResponse.json({ success: false, message: "Session expired" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  return respondAuthed(call.result.body, call.result.status, call.rotated);
}

/**
 * Builds a JSON response from a backend body, re-storing rotated session tokens
 * when present.
 */
export function respondAuthed(
  body: unknown,
  status: number,
  rotated?: Rotated,
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (rotated) setAuthCookies(res, rotated.accessToken, rotated.refreshToken);
  return res;
}
