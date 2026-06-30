import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { callAuthedBackend } from "@/lib/server/session";
import {
  clearAuthCookies,
  setAccessCookie,
  setAuthCookies,
  setRoleCookie,
} from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";
import { switchRoleSchema } from "@/lib/validation/auth";
import type { SessionPayload } from "@/types/auth";

const log = createLogger("auth:switch-role");

/** Backend `data` for a successful role switch (carries a fresh access token). */
type SwitchData = {
  accessToken: string;
  active_role: SessionPayload["active_role"];
  user: SessionPayload["user"];
  profile: SessionPayload["profile"];
};

/**
 * `POST /api/auth/switch-role` — flips the active account context for a user who
 * holds **both** `worker` and `business` roles (backs the "Switch account"
 * button on the profile screen).
 *
 * The backend mints a **new access token** carrying the new `active_role`; the
 * refresh token is unchanged. We overwrite the access cookie with that token so
 * every subsequent BFF call acts in the new context, and update the role cookie
 * so `/auth/me` resolves the same context on next entry. Role-specific endpoints
 * are enforced by active context server-side (see api-guidelines → Account context).
 *
 * @param req - JSON body `{ role }` (see {@link switchRoleSchema}); carries the
 *   httpOnly auth cookies.
 * @returns `200` with the new {@link SessionPayload} (tokens in Set-Cookie only),
 *   `403` when the user lacks the target role, or `401` for a dead session.
 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = switchRoleSchema.safeParse(json);
  if (!parsed.success) {
    log.warn("rejected invalid switch payload");
    return NextResponse.json({ success: false, message: "Invalid role" }, { status: 422 });
  }

  const call = await callAuthedBackend<{ data: SwitchData }>(req, "/auth/switch-role", {
    method: "POST",
    body: parsed.data,
  });

  if (call.kind === "no-session") {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }
  if (call.kind === "expired") {
    const res = NextResponse.json({ success: false, message: "Session expired" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  const { result, rotated } = call;
  if (!result.ok) {
    log.warn("switch failed", { role: parsed.data.role, status: result.status });
    return NextResponse.json(result.body, { status: result.status });
  }

  const data = result.body.data;
  const payload: SessionPayload = {
    user: data.user,
    active_role: data.active_role,
    profile: data.profile,
  };

  const res = NextResponse.json(
    { success: true, message: result.body.message ?? "Switched account", data: payload },
    { status: 200 },
  );
  // If the authed call refreshed mid-flight, persist that rotated pair first —
  // then overwrite the access cookie with the new-context token switch-role minted.
  if (rotated) setAuthCookies(res, rotated.accessToken, rotated.refreshToken);
  setAccessCookie(res, data.accessToken);
  if (data.active_role) setRoleCookie(res, data.active_role);

  log.info("role switched", { userId: data.user.id, role: data.active_role });
  return res;
}
