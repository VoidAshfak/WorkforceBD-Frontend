import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createLogger } from "@/lib/logger";

const log = createLogger("admin-cookies");

/**
 * Admin session cookies — deliberately separate from the worker/business ones
 * (`wfbd_at` / `wfbd_rt`) so the two sessions can never be confused for one
 * another, and so signing out of one leaves the other intact.
 *
 * Hardening vs. the app session:
 * - `sameSite: "strict"` — an admin request is never made from a third-party
 *   context, so no cross-site request should ever carry these.
 * - **No `maxAge`** — these are browser-session cookies: closing the browser
 *   drops them and the admin must sign in again.
 * - An HMAC-signed idle stamp rides alongside; every admin call re-checks and
 *   re-issues it, so a session dies after {@link IDLE_TIMEOUT_MS} of inactivity.
 */
export const ADMIN_ACCESS_COOKIE = "wfbd_adm_at";
export const ADMIN_REFRESH_COOKIE = "wfbd_adm_rt";
export const ADMIN_IDLE_COOKIE = "wfbd_adm_idle";

/** Inactivity window. Any admin request slides it forward. */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const baseOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // No maxAge/expires on purpose → session cookie, cleared when the browser closes.
};

/**
 * Signing key for the idle stamp. Set `ADMIN_SESSION_SECRET` in the environment;
 * without it we fall back to a per-process random key, which is still safe (the
 * stamp just can't be verified across restarts or instances — admins re-login).
 */
const SECRET: string = (() => {
  const fromEnv = process.env.ADMIN_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    log.warn("ADMIN_SESSION_SECRET missing or too short — using an ephemeral key");
  }
  return randomBytes(32).toString("hex");
})();

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Constant-time compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** `<expiresAtMs>.<hmac>` — tamper-proof, so the client can't extend its own session. */
function makeStamp(expiresAt: number): string {
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

/**
 * Reads the idle stamp and reports whether the session is still within its
 * inactivity window. An absent, malformed, forged, or expired stamp is a dead
 * session.
 */
export function isIdleStampValid(req: NextRequest): boolean {
  const raw = req.cookies.get(ADMIN_IDLE_COOKIE)?.value;
  if (!raw) return false;

  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return false;
  if (!safeEqual(mac, sign(payload))) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;

  return Date.now() < expiresAt;
}

/** Slides the inactivity deadline forward — called on every authenticated admin call. */
export function touchIdleStamp(res: NextResponse): void {
  res.cookies.set(ADMIN_IDLE_COOKIE, makeStamp(Date.now() + IDLE_TIMEOUT_MS), baseOptions);
}

export function setAdminCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookies.set(ADMIN_ACCESS_COOKIE, accessToken, baseOptions);
  res.cookies.set(ADMIN_REFRESH_COOKIE, refreshToken, baseOptions);
  touchIdleStamp(res);
}

export function setAdminAccessCookie(res: NextResponse, accessToken: string): void {
  res.cookies.set(ADMIN_ACCESS_COOKIE, accessToken, baseOptions);
}

export function clearAdminCookies(res: NextResponse): void {
  for (const name of [ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, ADMIN_IDLE_COOKIE]) {
    res.cookies.set(name, "", { ...baseOptions, maxAge: 0 });
  }
}
