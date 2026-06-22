import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/worker/profile` — full worker profile (name, picture, skills, zones). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/worker/profile", { method: "GET" });
}
