import "server-only";

import type { NextResponse } from "next/server";

/**
 * httpOnly cookie storage for the session tokens (web recommendation in
 * /docs/api-guidelines.md → Token Storage). The browser can send them but
 * cannot read them from JS, so XSS can't exfiltrate the tokens.
 */
export const ACCESS_COOKIE = "wfbd_at";
export const REFRESH_COOKIE = "wfbd_rt";
export const ROLE_COOKIE = "wfbd_role";

// Access token lives 15m on the server; refresh token 30d.
const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const baseOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...baseOptions, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...baseOptions, maxAge: REFRESH_MAX_AGE });
}

export function setAccessCookie(res: NextResponse, accessToken: string): void {
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...baseOptions, maxAge: ACCESS_MAX_AGE });
}

/** Remembers which role context the user authenticated into. Not a secret. */
export function setRoleCookie(res: NextResponse, role: string): void {
  res.cookies.set(ROLE_COOKIE, role, { ...baseOptions, maxAge: REFRESH_MAX_AGE });
}

export function clearAuthCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, ROLE_COOKIE]) {
    res.cookies.set(name, "", { ...baseOptions, maxAge: 0 });
  }
}
