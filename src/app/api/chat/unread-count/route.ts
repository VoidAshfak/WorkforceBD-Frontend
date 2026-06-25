import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `GET /api/chat/unread-count` — total unread messages across all the caller's
 * conversations. Bind to the chat badge.
 */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/chat/unread-count", { method: "GET" });
}
