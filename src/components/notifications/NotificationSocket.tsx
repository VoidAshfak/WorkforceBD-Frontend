"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

import { useAppDispatch } from "@/store/hooks";
import { notificationsApi } from "@/store/api/notificationsApi";
import { fetchSocketTicket, SOCKET_URL } from "@/lib/realtime";
import { createLogger } from "@/lib/logger";
import type { AppNotification } from "@/types/notification";

const log = createLogger("notif-socket");

type NewNotification = { notification: AppNotification; unread_count: number };

/**
 * Live notification bridge. Connects to the Socket.IO server with a short-lived
 * ticket and folds `notification:new` events straight into the RTK Query cache
 * (badge count + feed) — no polling, no token in the browser.
 *
 * The ticket is fetched lazily via the `auth` callback, which Socket.IO invokes
 * before every (re)connect, so reconnects always handshake with a fresh ticket.
 * Renders nothing; mount once inside the authenticated app shell.
 */
export default function NotificationSocket() {
  const dispatch = useAppDispatch();

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

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [dispatch]);

  return null;
}
