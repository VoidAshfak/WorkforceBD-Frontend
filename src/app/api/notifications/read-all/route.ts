import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `PATCH /api/notifications/read-all` — mark every unread notification read. */
export async function PATCH(req: NextRequest) {
  return proxyAuthed(req, "/notifications/read-all", { method: "PATCH" });
}
