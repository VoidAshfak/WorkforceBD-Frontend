"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { notificationsApi } from "@/store/api/notificationsApi";
import { chatApi } from "@/store/api/chatApi";
import { fetchSocketTicket, SOCKET_URL } from "@/lib/realtime";
import { createLogger } from "@/lib/logger";
import type { AppNotification } from "@/types/notification";
import type { ChatMessage } from "@/types/chat";

const log = createLogger("notif-socket");

type NewNotification = { notification: AppNotification; unread_count: number };
type ChatMessageEvent = { conversation_id: string; message: ChatMessage };
type ChatReadEvent = { conversation_id: string; read_at: string };

/**
 * Live notification bridge. Connects to the Socket.IO server with a short-lived
 * ticket and folds `notification:new` events straight into the RTK Query cache
 * (badge count + feed) — no polling, no token in the browser.
 *
 * The ticket is fetched lazily via the `auth` callback, which Socket.IO invokes
 * before every (re)connect, so reconnects always handshake with a fresh ticket.
 * Renders nothing; mount once inside the authenticated app shell.
 *
 * The socket ticket captures the caller's active role at mint time, and chat is
 * scoped to that role server-side. So the connection is keyed on `activeRole`:
 * switching context tears down the old socket and reconnects with a fresh,
 * correctly-scoped ticket — otherwise chat events would stay bound to the old
 * side. (Chat RTK caches are reset at switch time by the profile screen.)
 */
export default function NotificationSocket() {
  const dispatch = useAppDispatch();
  const activeRole = useAppSelector((s) => s.auth.activeRole);

  useEffect(() => {
    let active = true;

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket"],
      // Called before each connection attempt → always a fresh ticket.
      auth: (cb) => {
        fetchSocketTicket()
          .then((token) => cb({ token }))
          .catch((err) => {
            log.warn("ticket fetch failed", { error: (err as Error).message });
            cb({ token: "" }); // server rejects → connect_error, then retry
          });
      },
    });

    socket.on("connect", () => log.debug("connected"));
    socket.on("connect_error", (err) => log.warn("connect_error", { message: err.message }));

    socket.on("notification:new", ({ notification, unread_count }: NewNotification) => {
      if (!active) return;

      // Bind the fresh total straight to the badge.
      dispatch(
        notificationsApi.util.updateQueryData("getUnreadCount", undefined, () => unread_count),
      );

      // Prepend into any open feed cache (all / unread-only); no-op if unsubscribed.
      for (const unread of [false, true]) {
        dispatch(
          notificationsApi.util.updateQueryData("getNotifications", { unread }, (draft) => {
            if (draft.items.some((n) => n.id === notification.id)) return;
            draft.items.unshift(notification);
            draft.unread_count = unread_count;
            draft.pagination.total += 1;
          }),
        );
      }
    });

    // Live chat: fold a new message into the open thread (newest-first) and
    // refresh the badge/inbox. No-op when the thread isn't mounted.
    socket.on("chat:message", ({ conversation_id, message }: ChatMessageEvent) => {
      if (!active) return;
      dispatch(
        chatApi.util.updateQueryData("getMessages", { id: conversation_id }, (draft) => {
          if (draft.items.some((m) => m.id === message.id)) return; // dedupe
          draft.items.unshift(message);
        }),
      );
      dispatch(chatApi.util.invalidateTags(["ChatUnread", "ChatInbox"]));
    });

    // Read receipt: flip our own sent messages to read in the open thread.
    socket.on("chat:read", ({ conversation_id, read_at }: ChatReadEvent) => {
      if (!active) return;
      dispatch(
        chatApi.util.updateQueryData("getMessages", { id: conversation_id }, (draft) => {
          for (const m of draft.items) {
            if (m.sender_role === draft.conversation.side && !m.read_at) m.read_at = read_at;
          }
        }),
      );
    });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [dispatch, activeRole]);

  return null;
}
