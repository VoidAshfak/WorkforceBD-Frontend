import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `GET /api/chat/unread-count` — unread message total for the chat badge.
 * Optional `shift_id` scopes the count to a single shift's conversations (a
 * per-shift badge on the created-shift page); omit it for the global total.
 */
export async function GET(req: NextRequest) {
  const shiftId = req.nextUrl.searchParams.get("shift_id");
  const query = shiftId ? `?shift_id=${encodeURIComponent(shiftId)}` : "";
  return proxyAuthed(req, `/chat/unread-count${query}`, { method: "GET" });
}
