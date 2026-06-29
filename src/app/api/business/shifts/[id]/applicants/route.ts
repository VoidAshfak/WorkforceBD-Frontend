import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";

/** Whitelisted query params forwarded to `GET /business/shifts/:id/applicants`. */
const ALLOWED = ["status", "page", "limit"] as const;

/**
 * `GET /api/business/shifts/:id/applicants` — applicants for an owned shift with
 * worker reputation telemetry. Only known query params are forwarded.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(
    req,
    `/business/shifts/${encodeURIComponent(id)}/applicants${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
}
