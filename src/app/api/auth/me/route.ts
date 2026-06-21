import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ROLE_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";
import type { ProfileSummary, Role, SessionPayload } from "@/types/auth";

const log = createLogger("auth:me");

/** Backend `/auth/me` data — one profile summary per role the user holds. */
type MeData = {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
  is_phone_verified: boolean;
  profiles: Partial<Record<Role, ProfileSummary | null>>;
};

/**
 * Resolves which role/profile to surface as "active".
 *
 * Prefers the role the user last authenticated into (the `wfbd_role` cookie),
 * then the first role that has a profile, then the first role at all.
 *
 * @param data - The backend `/auth/me` payload.
 * @param preferred - Role from the `wfbd_role` cookie, if any.
 */
function pickActive(data: MeData, preferred: Role | undefined): {
  active_role: Role | null;
  profile: ProfileSummary | null;
} {
  if (preferred && data.profiles[preferred]) {
    return { active_role: preferred, profile: data.profiles[preferred] ?? null };
  }
  const role = data.roles.find((r) => data.profiles[r]) ?? data.roles[0] ?? null;
  return { active_role: role, profile: role ? data.profiles[role] ?? null : null };
}

/**
 * `GET /api/auth/me` — validates the session and returns the current user.
 *
 * Called on app entry. If the access token is missing or rejected, it
 * transparently calls `/auth/refresh`, re-stores **both** rotated tokens (the
 * refresh token is single-use), and retries. A dead session clears the cookies
 * and returns `401`, which the client treats as "go to /welcome".
 *
 * @param req - Carries the httpOnly auth cookies.
 * @returns `200` with the safe {@link SessionPayload}, or `401` when unauthenticated.
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const preferredRole = req.cookies.get(ROLE_COOKIE)?.value as Role | undefined;

  if (!accessToken && !refreshToken) {
    log.debug("no session cookies");
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  let token = accessToken;
  let rotated: { accessToken: string; refreshToken: string } | undefined;

  // Refresh the access token if it is missing or rejected.
  const fetchMe = (t?: string) =>
    backend<{ data: MeData }>("/auth/me", { method: "GET", accessToken: t });

  let me = token ? await fetchMe(token) : { ok: false, status: 401, body: {} as never };

  if (!me.ok && me.status === 401 && refreshToken) {
    log.debug("access token rejected, refreshing");
    const refreshed = await backend<{ data: { accessToken: string; refreshToken: string } }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refreshToken } },
    );

    if (!refreshed.ok) {
      log.info("refresh failed, clearing session", { status: refreshed.status });
      const res = NextResponse.json(
        { success: false, message: "Session expired" },
        { status: 401 },
      );
      clearAuthCookies(res);
      return res;
    }

    rotated = refreshed.body.data;
    token = rotated.accessToken;
    me = await fetchMe(token);
  }

  if (!me.ok) {
    const res = NextResponse.json(
      { success: false, message: me.body?.message ?? "Not authenticated" },
      { status: me.status === 401 ? 401 : me.status },
    );
    if (me.status === 401) clearAuthCookies(res);
    return res;
  }

  const data = me.body.data;
  const { active_role, profile } = pickActive(data, preferredRole);
  const payload: SessionPayload = {
    user: {
      id: data.id,
      phone: data.phone,
      email: data.email,
      full_name: data.full_name,
      roles: data.roles,
      is_phone_verified: data.is_phone_verified,
    },
    active_role,
    profile,
  };

  const res = NextResponse.json({ success: true, message: "Authenticated", data: payload });
  if (rotated) setAuthCookies(res, rotated.accessToken, rotated.refreshToken);

  log.debug("session validated", { userId: data.id, role: active_role, refreshed: Boolean(rotated) });
  return res;
}
