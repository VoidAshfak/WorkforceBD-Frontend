import type { NextRequest } from "next/server";

import { proxyAdmin } from "@/lib/server/adminSession";

/** `GET /api/admin/settings` — runtime-tunable platform constants with live values. */
export async function GET(req: NextRequest) {
  return proxyAdmin(req, "/admin/settings", { method: "GET" });
}
