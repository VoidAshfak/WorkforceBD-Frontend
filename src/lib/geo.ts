/**
 * Geo helpers for the explore map.
 *
 * Shifts carry a real `coordinates` (WGS84) field, used directly for pins. When
 * a shift has no location set (`coordinates: null`), we fall back to its zone's
 * centroid plus a small deterministic per-shift jitter so locationless shifts in
 * the same area fan out instead of stacking on one point.
 */

import type { Shift } from "@/types/shift";

export type LngLat = [number, number];

/** Dhaka city center — fallback when a shift's zone is unknown. */
export const DHAKA_CENTER: LngLat = [90.4074, 23.7806];

/**
 * Approximate centroids (lng, lat) for common Dhaka zones. Lowercase keys;
 * matched by substring so "Gulshan 1" / "Gulshan 2" both resolve to Gulshan.
 */
const ZONE_CENTROIDS: { key: string; at: LngLat }[] = [
  { key: "uttara", at: [90.3795, 23.8759] },
  { key: "mirpur", at: [90.3654, 23.8223] },
  { key: "banani", at: [90.4066, 23.7937] },
  { key: "gulshan", at: [90.4143, 23.7925] },
  { key: "bashundhara", at: [90.4486, 23.8156] },
  { key: "baridhara", at: [90.4255, 23.8045] },
  { key: "mohakhali", at: [90.4053, 23.7783] },
  { key: "tejgaon", at: [90.392, 23.7639] },
  { key: "farmgate", at: [90.3895, 23.758] },
  { key: "badda", at: [90.4267, 23.7806] },
  { key: "rampura", at: [90.421, 23.761] },
  { key: "khilgaon", at: [90.426, 23.751] },
  { key: "mugda", at: [90.435, 23.737] },
  { key: "motijheel", at: [90.4172, 23.733] },
  { key: "dhanmondi", at: [90.3742, 23.7461] },
  { key: "mohammadpur", at: [90.3589, 23.766] },
  { key: "shyamoli", at: [90.365, 23.774] },
  { key: "wari", at: [90.42, 23.718] },
  { key: "lalbagh", at: [90.388, 23.719] },
  { key: "old dhaka", at: [90.4, 23.71] },
  { key: "savar", at: [90.2667, 23.8583] },
];

/** Stable 0..1 pseudo-random from a string + salt (no external dep). */
function unitHash(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  // Map the 32-bit int into [0, 1).
  return (Math.abs(h) % 100000) / 100000;
}

/**
 * Resolves a shift's plot position: its real coordinates when set, otherwise the
 * zone centroid + deterministic jitter.
 */
export function shiftLatLng(shift: Shift): LngLat {
  if (shift.coordinates) {
    return [shift.coordinates.longitude, shift.coordinates.latitude];
  }

  const name = (shift.zones?.name ?? shift.address ?? "").toLowerCase();
  const match = ZONE_CENTROIDS.find((z) => name.includes(z.key));
  const base = match?.at ?? DHAKA_CENTER;

  // ±~0.012° spread (~1.3km) so same-zone shifts don't overlap.
  const jLng = (unitHashOrZero(shift.id, 7) - 0.5) * 0.024;
  const jLat = (unitHashOrZero(shift.id, 13) - 0.5) * 0.024;
  return [base[0] + jLng, base[1] + jLat];
}

/** Guards against an empty id producing NaN. */
function unitHashOrZero(id: string, salt: number): number {
  return id ? unitHash(id, salt) : 0.5;
}

/** Promisified high-accuracy geolocation → `[lng, lat]`. Rejects on deny/timeout. */
export function currentLngLat(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Enable location access for directions"
              : "Couldn't get your location. Try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/** A driving route between two points, with summary stats. */
export type Route = { coordinates: LngLat[]; distanceM: number; durationS: number };

/** Lifecycle of an in-app directions request, shared map ⇄ sheet. */
export type RouteStatus =
  | { state: "loading" }
  | { state: "ready"; distanceM: number; durationS: number; fallback: boolean }
  | { state: "error"; message: string };

/** "3.2 km · 12 min", or just the distance when no ETA (straight-line fallback). */
export function routeSummary(distanceM: number, durationS: number): string {
  const km =
    distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`;
  if (durationS <= 0) return km;
  const mins = Math.max(1, Math.round(durationS / 60));
  return `${km} · ${mins} min`;
}

/**
 * Driving route `from` → `to` using the public OSRM demo router. On any failure
 * (offline, rate-limit, no road route) it falls back to a straight line with a
 * great-circle distance estimate, so the directions feature always returns
 * something drawable.
 */
export async function fetchRoute(from: LngLat, to: LngLat): Promise<Route> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length > 1) {
        return {
          coordinates: coords as LngLat[],
          distanceM: Number(route.distance) || haversineM(from, to),
          durationS: Number(route.duration) || 0,
        };
      }
    }
  } catch {
    /* fall through to the straight-line fallback */
  }
  return { coordinates: [from, to], distanceM: haversineM(from, to), durationS: 0 };
}

/** Great-circle distance in metres between two `[lng, lat]` points. */
export function haversineM([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** `https://www.google.com/maps/dir` deep link to a shift (origin = device). */
export function googleMapsDirUrl(dest: LngLat): string {
  // Omitting `origin` makes Google use the user's current location.
  return `https://www.google.com/maps/dir/?api=1&destination=${dest[1]},${dest[0]}&travelmode=driving`;
}
