import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("chat:messages");

const sendSchema = z.object({ body: z.string().trim().min(1).max(2000) });

const ALLOWED = ["page", "limit"] as const;

/**
 * `GET /api/chat/conversations/:id/messages` — message history (newest first).
 * Fetching marks incoming messages read server-side and emits a `chat:read`.
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
    `/chat/conversations/${encodeURIComponent(id)}/messages${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
}

/**
 * `POST /api/chat/conversations/:id/messages` — send a message (1–2000 chars).
 * The backend persists it and broadcasts `chat:message` to both participants.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid send-message", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Message body is required" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, `/chat/conversations/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: parsed.data,
  });
}
