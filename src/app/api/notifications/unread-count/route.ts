import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/notifications/unread-count` — badge count for the session user. */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/notifications/unread-count", { method: "GET" });
}
