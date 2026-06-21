import { NextResponse } from "next/server";

import { backend } from "@/lib/server/backend";
import { phoneSchema } from "@/lib/validation/auth";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = phoneSchema.safeParse(json?.phone);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Enter a valid BD number (+8801XXXXXXXXX)" },
      { status: 422 },
    );
  }

  const result = await backend("/auth/send-otp", {
    method: "POST",
    body: { phone: parsed.data },
  });

  return NextResponse.json(result.body, { status: result.status });
}
