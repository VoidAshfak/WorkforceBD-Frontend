import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/payments/wallet` — worker wallet snapshot (balance / earnings). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/payments/wallet", { method: "GET" });
}
