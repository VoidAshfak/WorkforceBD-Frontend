import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/business/wallet` — business wallet snapshot (balance / held / spent). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/business/wallet", { method: "GET" });
}
