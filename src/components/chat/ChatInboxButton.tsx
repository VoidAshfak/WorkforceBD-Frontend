"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { useGetChatUnreadCountQuery } from "@/store/api/chatApi";

/**
 * Header icon linking to the chat inbox, with a live unread badge. The count is
 * kept fresh by the Socket.IO bridge (`NotificationSocket` invalidates the
 * `ChatUnread` tag on `chat:message`); focus/reconnect/poll backfill anything
 * missed offline.
 */
export default function ChatInboxButton({ className = "" }: { className?: string }) {
  const { data: unread = 0 } = useGetChatUnreadCountQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <Link
      href="/chat"
      aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95 ${className}`}
    >
      <MessageCircle size={20} strokeWidth={2.1} />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
