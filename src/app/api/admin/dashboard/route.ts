import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** `GET /api/admin/dashboard` — headline platform counters for the home screen. */
export async function GET(req: NextRequest) {
  return proxyAdmin(req, "/admin/dashboard", { method: "GET" });
}
