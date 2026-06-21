import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { REFRESH_COOKIE, clearAuthCookies } from "@/lib/server/authCookies";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  // Best-effort server revoke; we clear the client session regardless.
  if (refreshToken) {
    await backend("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ success: true, message: "Logged out" });
  clearAuthCookies(res);
  return res;
}
