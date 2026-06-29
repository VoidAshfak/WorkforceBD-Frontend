import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/business/dashboard` — business home counters (active / waiting / fill rate). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/business/dashboard", { method: "GET" });
}
