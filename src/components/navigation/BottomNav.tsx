"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BOTTOM_NAV_ITEMS } from "@/config/navigation";

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Universal mobile bottom navigation. Fixed to the viewport bottom, thumb-friendly
 * 56px+ touch targets, active tab anchored by a brand-yellow indicator.
 */
/** Focused sub-screens that hide the nav for an immersive, full-height flow. */
const HIDDEN_ON = ["/profile/edit", "/shifts/new"];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on focused sub-screens, and on a chat *thread* (`/chat/:id`) — but keep
  // it on the chat inbox (`/chat`).
  const hidden =
    HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/chat/");
  if (hidden) return null;

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex h-full min-h-14 flex-col items-center justify-center gap-1 rounded-2xl transition-colors"
              >
                <span
                  aria-hidden
                  className={`absolute top-0 h-0.5 w-8 rounded-full bg-brand transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon
                  size={24}
                  strokeWidth={active ? 2.4 : 2}
                  className={
                    active
                      ? "text-ink transition-transform group-active:scale-90"
                      : "text-text-tertiary transition-transform group-active:scale-90"
                  }
                />
                <span
                  className={`text-[11px] leading-none ${
                    active ? "font-semibold text-ink" : "font-normal text-text-tertiary"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
