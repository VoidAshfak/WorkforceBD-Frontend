import { Compass, Home, type LucideIcon, User, Wallet, Activity } from "lucide-react";

import type { Role } from "@/lib/validation/auth";

/**
 * Bottom navigation (see /docs/FRONTEND_CONTEXT.md → Navigation Structure). Page
 * content changes per role; the tab set is mostly shared. `roles` restricts an
 * item to specific roles (absent = shown for everyone). Edit this list to change
 * the nav globally.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item only appears for these active roles. */
  roles?: Role[];
};

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  // Explore is the worker's nearby-shifts map — businesses post, they don't browse.
  { label: "Explore", href: "/explore", icon: Compass, roles: ["worker"] },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Profile", href: "/profile", icon: User },
];

/** Nav items visible for the given active role. */
export function navItemsForRole(role: Role | null | undefined): NavItem[] {
  return BOTTOM_NAV_ITEMS.filter((item) => !item.roles || (role != null && item.roles.includes(role)));
}
