import { NextResponse } from "next/server";

import { backend } from "@/lib/server/backend";
import { setAuthCookies, setRoleCookie } from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";
import { verifySchema } from "@/lib/validation/auth";
import type { SessionPayload } from "@/types/auth";

const log = createLogger("auth:verify-otp");

/** Backend `data` payload for a successful OTP verification (includes tokens). */
type VerifyData = {
  accessToken: string;
  refreshToken: string;
  user: SessionPayload["user"];
  active_role: SessionPayload["active_role"];
  profile: SessionPayload["profile"];
};

/**
 * `POST /api/auth/verify-otp` — verifies the OTP and opens a session.
 *
 * On success it strips the tokens out of the response, persists them as
 * httpOnly cookies via {@link setAuthCookies}, and returns only the safe
 * {@link SessionPayload} to the client.
 *
 * @param req - JSON body `{ phone, otp_code, role }` (see {@link verifySchema}).
 * @returns `200` with the session payload (tokens in Set-Cookie only), or the
 *   backend error status (`400` invalid/expired OTP, `403` deactivated, …).
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    log.warn("rejected invalid verify payload");
    return NextResponse.json(
      { success: false, message: "Invalid verification details" },
      { status: 422 },
    );
  }

  const result = await backend<{ data: VerifyData }>("/auth/verify-otp", {
    method: "POST",
    body: parsed.data,
  });

  if (!result.ok) {
    log.warn("verification failed", { phone: parsed.data.phone, status: result.status });
    return NextResponse.json(result.body, { status: result.status });
  }

  const data = (result.body as { data: VerifyData }).data;
  const payload: SessionPayload = {
    user: data.user,
    active_role: data.active_role,
    profile: data.profile,
  };

  const res = NextResponse.json(
    { success: true, message: result.body.message ?? "Authenticated", data: payload },
    { status: 200 },
  );
  setAuthCookies(res, data.accessToken, data.refreshToken);
  if (data.active_role) setRoleCookie(res, data.active_role);

  log.info("session opened", {
    userId: data.user.id,
    role: data.active_role,
    verification: data.profile?.verification_status,
  });
  return res;
}
