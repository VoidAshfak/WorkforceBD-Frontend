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
import type { ProfileSummary, Role, SessionPayload } from "@/types/auth";

type MeData = {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
  is_phone_verified: boolean;
  profiles: Partial<Record<Role, ProfileSummary | null>>;
};

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

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const preferredRole = req.cookies.get(ROLE_COOKIE)?.value as Role | undefined;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }

  let token = accessToken;
  let rotated: { accessToken: string; refreshToken: string } | undefined;

  // Refresh the access token if it is missing or rejected.
  const fetchMe = (t?: string) =>
    backend<{ data: MeData }>("/auth/me", { method: "GET", accessToken: t });

  let me = token ? await fetchMe(token) : { ok: false, status: 401, body: {} as never };

  if (!me.ok && me.status === 401 && refreshToken) {
    const refreshed = await backend<{ data: { accessToken: string; refreshToken: string } }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refreshToken } },
    );

    if (!refreshed.ok) {
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
  return res;
}
