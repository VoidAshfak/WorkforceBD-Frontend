import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `GET /api/applications/summary` — Activity-tab header counts (application
 * totals + unread notifications). Worker context; the backend's `404` when no
 * worker profile exists passes through.
 */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/applications/summary", { method: "GET" });
}
