import { Compass, Home, type LucideIcon, User, Wallet, Activity } from "lucide-react";

/**
 * Universal bottom navigation (see /docs/FRONTEND_CONTEXT.md → Navigation Structure).
 * Same five tabs for every role — only the page content changes per role.
 * Edit this list to change the nav globally.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Profile", href: "/profile", icon: User },
];
