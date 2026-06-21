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
