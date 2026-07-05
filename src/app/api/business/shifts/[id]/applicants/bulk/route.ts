import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("business:applicants-bulk");

/** Bulk shortlist/reject payload (see /docs/api-guidelines.md). */
const bulkSchema = z.object({
  action: z.enum(["shortlist", "reject"]),
  application_ids: z.array(z.string().min(1)).min(1).max(100),
});

/**
 * `POST /api/business/shifts/:id/applicants/bulk` — bulk shortlist or reject
 * applicants on an owned shift. Hiring is intentionally not bulk (capacity is
 * per-slot). Already-decided/foreign ids are skipped and counted by the backend.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log.warn("invalid bulk action", { issues: parsed.error.issues.length });
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }
  return proxyAuthed(req, `/business/shifts/${encodeURIComponent(id)}/applicants/bulk`, {
    method: "POST",
    body: parsed.data,
  });
}
