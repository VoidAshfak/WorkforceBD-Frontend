import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/**
 * `POST /api/realtime/ticket` — mints a short-lived (~60s), single-purpose
 * Socket.IO handshake ticket for the session user. The real access token stays
 * in the httpOnly cookie; only this audience-scoped ticket reaches the browser.
 */
export async function POST(req: NextRequest) {
  return proxyAuthed(req, "/realtime/ticket", { method: "POST" });
}
