import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";
import { ACCESS_COOKIE, clearAuthCookies } from "@/lib/server/authCookies";
import { callAuthedBackend, respondAuthed } from "@/lib/server/session";
import { createLogger } from "@/lib/logger";
import type { CatalogItem, WorkerCatalog } from "@/types/worker";

const log = createLogger("worker:catalog");

/**
 * Maps a backend skill/zone list (a flat `data` array per api-guidelines.md →
 * GET /worker/skills, /worker/zones) into `CatalogItem[]`. Skills carry
 * `category_id`; zones carry `city_id` + a nested `cities` object — kept so the
 * picker can group/filter by city later. The wizard only needs `id`/`name`.
 */
function toItems(data: unknown): CatalogItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const r = row as {
        id?: string;
        name?: string;
        category_id?: string;
        city_id?: string;
        cities?: { id?: string; name?: string } | null;
      };
      if (!r?.id || !r?.name) return null;
      return {
        id: r.id,
        name: r.name,
        ...(r.category_id ? { categoryId: r.category_id } : {}),
        ...(r.city_id ? { cityId: r.city_id } : {}),
        ...(r.cities?.name ? { city: r.cities.name } : {}),
      } satisfies CatalogItem;
    })
    .filter((x): x is CatalogItem => x !== null);
}

/**
 * `GET /api/worker/catalog` — bundles the worker skill and zone catalogs into a
 * single round-trip for the onboarding picker. Both backend lists are protected,
 * so the access token is injected from cookies (with refresh) by the BFF.
 */
export async function GET(req: NextRequest) {
  const skillsCall = await callAuthedBackend<{ data: unknown }>(req, "/worker/skills", {
    method: "GET",
  });

  if (skillsCall.kind === "no-session") {
    return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
  }
  if (skillsCall.kind === "expired") {
    const res = NextResponse.json({ success: false, message: "Session expired" }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }

  // Reuse the freshest token (rotated if a refresh happened) for the zones call.
  const token = skillsCall.rotated?.accessToken ?? req.cookies.get(ACCESS_COOKIE)?.value;
  const zonesRes = await backend<{ data: unknown }>("/worker/zones", {
    method: "GET",
    accessToken: token,
  });

  if (!skillsCall.result.ok || !zonesRes.ok) {
    log.warn("catalog fetch failed", {
      skills: skillsCall.result.status,
      zones: zonesRes.status,
    });
    const status = skillsCall.result.ok ? zonesRes.status : skillsCall.result.status;
    return respondAuthed(
      { success: false, message: "Could not load options" },
      status === 401 ? 401 : 502,
      skillsCall.rotated,
    );
  }

  const payload: WorkerCatalog = {
    skills: toItems(skillsCall.result.body.data),
    zones: toItems(zonesRes.body.data),
  };

  log.debug("catalog loaded", { skills: payload.skills.length, zones: payload.zones.length });
  return respondAuthed(
    { success: true, message: "Catalog fetched", data: payload },
    200,
    skillsCall.rotated,
  );
}
