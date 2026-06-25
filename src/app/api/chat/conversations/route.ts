import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("chat:conversations");

const openSchema = z.object({
  shift_id: z.string().uuid(),
  // Business callers name the worker; ignored for worker callers.
  worker_profile_id: z.string().uuid().optional(),
});

const ALLOWED = ["page", "limit"] as const;

/**
 * `GET /api/chat/conversations` — the caller's inbox, most-recent first.
 */
export async function GET(req: NextRequest) {
  const incoming = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return proxyAuthed(req, `/chat/conversations${query ? `?${query}` : ""}`, { method: "GET" });
}

/**
 * `POST /api/chat/conversations` — open (or fetch the existing) thread for a
 * `(shift, worker)` pair. Idempotent. The backend enforces the application gate.
 */
export async function POST(req: NextRequest) {
  const parsed = openSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid open-conversation", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, "/chat/conversations", { method: "POST", body: parsed.data });
}
