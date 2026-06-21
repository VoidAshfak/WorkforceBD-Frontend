import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/shifts/dashboard` — worker home counters (today / nearby / urgent). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/shifts/dashboard", { method: "GET" });
}
