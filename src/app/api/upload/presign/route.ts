import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { proxyAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";

const log = createLogger("upload:presign");

const PURPOSES = ["profile_picture", "nid_front", "nid_back", "selfie", "student_id"];

/**
 * `POST /api/upload/presign` — returns a one-shot Cloudinary signed credential.
 * The browser uploads the file straight to Cloudinary with it; the binary never
 * passes through this server (see /docs/api-guidelines.md → File Uploads).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { purpose?: string } | null;
  if (!body?.purpose || !PURPOSES.includes(body.purpose)) {
    log.warn("invalid purpose", { purpose: body?.purpose });
    return NextResponse.json({ success: false, message: "Invalid upload purpose" }, { status: 422 });
  }
  return proxyAuthed(req, "/upload/presign", { method: "POST", body: { purpose: body.purpose } });
}
