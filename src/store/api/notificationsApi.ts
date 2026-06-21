import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { AppNotification, NotificationFeed } from "@/types/notification";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

export type NotificationsQuery = {
  unread?: boolean;
  page?: number;
  limit?: number;
};

/**
 * Notification feed + read state. Talks only to the local BFF (`/api/notifications*`),
 * which injects the access token from httpOnly cookies.
 *
 * Live delivery rides Socket.IO via `NotificationSocket`, which folds
 * `notification:new` events into this cache (badge + feed). Mutations
 * optimistically patch the cache and refetch on settle; focus/poll refetch
 * backfills anything missed offline.
 */
export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["Notifications", "UnreadCount"],
  endpoints: (build) => ({
    getNotifications: build.query<NotificationFeed, NotificationsQuery>({
      query: (args) => ({ url: "/notifications", method: "GET", params: cleanParams(args) }),
      transformResponse: (res: ApiEnvelope<NotificationFeed>) => res.data,
      // One cache entry per `unread` filter (page excluded) so paging accumulates.
      serializeQueryArgs: ({ queryArgs }) => ({ unread: queryArgs.unread ?? false }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.unread_count = incoming.unread_count;
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Notifications"],
    }),

    getUnreadCount: build.query<number, void>({
      query: () => ({ url: "/notifications/unread-count", method: "GET" }),
      transformResponse: (res: ApiEnvelope<{ unread_count: number }>) => res.data.unread_count,
      providesTags: ["UnreadCount"],
    }),

    markRead: build.mutation<AppNotification, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      // Flip the row locally so the tap feels instant; the count refetches on settle.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData("getNotifications", { unread: false }, (draft) => {
            const row = draft.items.find((n) => n.id === id);
            if (row && !row.is_read) {
              row.is_read = true;
              row.read_at = new Date().toISOString();
              draft.unread_count = Math.max(0, draft.unread_count - 1);
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ["UnreadCount"],
    }),

    markAllRead: build.mutation<{ updated: number }, void>({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      transformResponse: (res: ApiEnvelope<{ updated: number }>) => res.data,
      invalidatesTags: ["Notifications", "UnreadCount"],
    }),
  }),
});

/** Drops undefined/empty values so the URL only carries real params. */
function cleanParams(args: NotificationsQuery): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
} = notificationsApi;
