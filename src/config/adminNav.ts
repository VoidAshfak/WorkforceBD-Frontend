import {
  BadgeCheck,
  Banknote,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AdminDashboard } from "@/types/admin";

/**
 * Left-panel navigation for the admin dashboard. `badge` pulls the live queue
 * count off `GET /admin/dashboard`, so the menu itself tells the admin where the
 * work is waiting.
 */
export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Work waiting on this screen, or 0 when the queue is clear. */
  badge?: (d: AdminDashboard) => number;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  {
    label: "Verifications",
    href: "/admin/verifications",
    icon: BadgeCheck,
    badge: (d) => d.pending_review.worker_verifications + d.pending_review.business_verifications,
  },
  {
    label: "Shift posts",
    href: "/admin/moderation",
    icon: ScrollText,
    badge: (d) => d.pending_review.shift_posts,
  },
  {
    label: "Disputes",
    href: "/admin/disputes",
    icon: ShieldAlert,
    badge: (d) => d.pending_review.open_disputes,
  },
  { label: "Payouts", href: "/admin/payouts", icon: Banknote },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: SlidersHorizontal },
];
