import { skillEmoji } from "@/config/onboarding";
import type { Shift } from "@/types/shift";

/**
 * Playful per-card visual themes for the swipe deck. Each theme is a gradient +
 * matching blob/ink colors, kept here (not hard-coded in the card) so the deck's
 * look can be retuned in one place. Colors echo the DESIGN.md brand palette while
 * giving each card its own personality.
 */
export type CardTheme = {
  /** Two-stop linear gradient for the card's hero zone. */
  gradient: string;
  /** Decorative blob fill (lighter accent). */
  blob: string;
  /** Secondary blob fill. */
  blobAlt: string;
};

const THEMES: CardTheme[] = [
  // Brand yellow
  { gradient: "linear-gradient(150deg, #FFE27A 0%, #FFC629 100%)", blob: "#FFF7DE", blobAlt: "#FFD95C" },
  // Mint / emerald
  { gradient: "linear-gradient(150deg, #9DE9C0 0%, #1A964A 100%)", blob: "#E4FBEF", blobAlt: "#5FCB92" },
  // Sky blue
  { gradient: "linear-gradient(150deg, #BFE4FF 0%, #1F98F9 100%)", blob: "#EAF6FF", blobAlt: "#6FC0FF" },
  // Warm coral
  { gradient: "linear-gradient(150deg, #FFC2A8 0%, #FF7A4D 100%)", blob: "#FFEDE3", blobAlt: "#FF9D78" },
  // Lavender
  { gradient: "linear-gradient(150deg, #D9C8FF 0%, #8B5CF6 100%)", blob: "#F1EBFF", blobAlt: "#B79BFF" },
];

/** Stable hash so a given shift always gets the same theme across renders. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Picks a deterministic theme for a shift, keyed by its id. */
export function cardTheme(id: string): CardTheme {
  return THEMES[hashId(id) % THEMES.length];
}

/** A big watermark emoji for the card's hero, derived from category/role/title. */
export function shiftEmoji(shift: Shift): string {
  const source = shift.categories?.name ?? shift.role_type ?? shift.title ?? "";
  return skillEmoji(source);
}
