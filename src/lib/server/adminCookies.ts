import "server-only";

import type { NextResponse } from "next/server";

/**
 * Admin session cookies — deliberately separate from the worker/business ones
 * (`wfbd_at` / `wfbd_rt`) so the two sessions can never be confused for one
 * another, and so signing out of one leaves the other intact.
 *
 * Lifecycle (see api-guidelines → POST /auth/admin/verify-2fa):
 * - **No `maxAge`/`expires`** → browser-session cookies. They survive a page
 *   refresh but are dropped when the browser closes, so the admin signs in again.
 * - The **10-minute sliding idle window is enforced by the backend**: every
 *   successful `/auth/refresh` pushes the deadline forward, and a refresh after
 *   the deadline returns `401` and revokes the session. The dashboard doesn't
 *   keep its own idle stamp — a second clock could only disagree with that one.
 * - `sameSite: "strict"` — an admin request is never made from a third-party
 *   context, so no cross-site request should ever carry these.
 *
 * The admin access token lives only 5 minutes, so `proxyAdmin` refreshes often;
 * the tokens themselves never leave the server.
 */
export const ADMIN_ACCESS_COOKIE = "wfbd_adm_at";
export const ADMIN_REFRESH_COOKIE = "wfbd_adm_rt";

/** Inactivity window. Mirrors the backend policy — used for the client-side countdown. */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const baseOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // No maxAge on purpose → session cookie, cleared when the browser closes.
};

export function setAdminCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set(ADMIN_ACCESS_COOKIE, accessToken, baseOptions);
  res.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, baseOptions);
}

export function clearAdminCookies(res: NextResponse): void {
  // `wfbd_adm_idle` is a leftover from the client-enforced idle stamp this code
  // used to keep; clear it so nobody is left holding a cookie nothing reads.
  for (const name of [ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, "wfbd_adm_idle"]) {
    res.cookies.set(name, "", { ...baseOptions, maxAge: 0 });
  }
}
