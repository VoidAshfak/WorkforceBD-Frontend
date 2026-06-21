"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { useGetUnreadCountQuery } from "@/store/api/notificationsApi";

/**
 * Header bell linking to the notifications feed, with a live unread badge.
 *
 * The count is kept live by the Socket.IO bridge (`NotificationSocket`) folding
 * `notification:new` into this same cache. Focus/reconnect refetch backfills
 * anything missed offline; a slow poll is a safety net if the socket is down.
 */
export default function NotificationBell({ className = "" }: { className?: string }) {
  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95 ${className}`}
    >
      <Bell size={20} strokeWidth={2.1} />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
