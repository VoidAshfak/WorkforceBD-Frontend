import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** `GET /api/categories` — shared shift categories for selection dropdowns (any role). */
export async function GET(req: NextRequest) {
  return proxyAuthed(req, "/categories", { method: "GET" });
}
