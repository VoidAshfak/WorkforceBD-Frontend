import { NextResponse } from "next/server";

import { backend } from "@/lib/server/backend";
import { setAuthCookies, setRoleCookie } from "@/lib/server/authCookies";
import { verifySchema } from "@/lib/validation/auth";
import type { SessionPayload } from "@/types/auth";

type VerifyData = {
  accessToken: string;
  refreshToken: string;
  user: SessionPayload["user"];
  active_role: SessionPayload["active_role"];
  profile: SessionPayload["profile"];
};

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
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
  return res;
}
