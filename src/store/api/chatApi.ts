import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { ChatMessage, Conversation, MessagesPage } from "@/types/chat";
import type { Paginated } from "@/types/shift";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

export type MessagesQuery = { id: string; page?: number; limit?: number };

/**
 * Per-shift worker⇄business chat. Talks only to the local BFF (`/api/chat*`),
 * which injects the access token from httpOnly cookies. Live delivery rides
 * Socket.IO (`chat:message`, `chat:read`) via `NotificationSocket`, which folds
 * events into the `getMessages` cache and invalidates the badge/inbox tags.
 */
export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["ChatInbox", "ChatUnread"],
  endpoints: (build) => ({
    // Open or fetch the existing thread for a (shift, worker) pair. Idempotent.
    openConversation: build.mutation<Conversation, { shift_id: string; worker_profile_id?: string }>({
      query: (body) => ({ url: "/chat/conversations", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<Conversation>) => res.data,
      invalidatesTags: ["ChatInbox"],
    }),

    getConversations: build.query<Paginated<Conversation>, { page?: number; limit?: number } | void>({
      query: (args) => ({ url: "/chat/conversations", method: "GET", params: cleanParams(args ?? {}) }),
      transformResponse: (res: ApiEnvelope<Paginated<Conversation>>) => res.data,
      providesTags: ["ChatInbox"],
    }),

    getMessages: build.query<MessagesPage, MessagesQuery>({
      query: ({ id, page, limit }) => ({
        url: `/chat/conversations/${id}/messages`,
        method: "GET",
        params: cleanParams({ page, limit }),
      }),
      transformResponse: (res: ApiEnvelope<MessagesPage>) => res.data,
      // One cache entry per conversation (page excluded) so "load older" appends
      // to the same growing thread; this is also the key the socket patches.
      serializeQueryArgs: ({ queryArgs }) => queryArgs.id,
      merge: (current, incoming, { arg }) => {
        current.conversation = incoming.conversation;
        current.pagination = incoming.pagination;
        if ((arg.page ?? 1) <= 1) {
          current.items = incoming.items;
          return;
        }
        // Older history (newest-first list) appends to the tail; dedupe by id.
        const seen = new Set(current.items.map((m) => m.id));
        current.items.push(...incoming.items.filter((m) => !seen.has(m.id)));
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
    }),

    sendMessage: build.mutation<ChatMessage, { id: string; body: string }>({
      query: ({ id, body }) => ({
        url: `/chat/conversations/${id}/messages`,
        method: "POST",
        body: { body },
      }),
      transformResponse: (res: ApiEnvelope<ChatMessage>) => res.data,
      // Optimistic: drop a temp message in immediately (list is newest-first, so
      // unshift), then reconcile with the persisted row on success.
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        const tempId = `temp-${Date.now()}`;
        const patch = dispatch(
          chatApi.util.updateQueryData("getMessages", { id }, (draft) => {
            draft.items.unshift({
              id: tempId,
              conversation_id: id,
              sender_user_id: "me",
              // Render on the caller's side of the thread.
              sender_role: draft.conversation.side,
              body,
              read_at: null,
              created_at: new Date().toISOString(),
            });
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            chatApi.util.updateQueryData("getMessages", { id }, (draft) => {
              const i = draft.items.findIndex((m) => m.id === tempId);
              const exists = draft.items.some((m) => m.id === data.id);
              if (i === -1) return;
              if (exists) draft.items.splice(i, 1); // socket already delivered it
              else draft.items[i] = data;
            }),
          );
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ["ChatInbox"],
    }),

    markConversationRead: build.mutation<{ updated: number }, string>({
      query: (id) => ({ url: `/chat/conversations/${id}/read`, method: "PATCH" }),
      transformResponse: (res: ApiEnvelope<{ updated: number }>) => res.data,
      invalidatesTags: ["ChatInbox", "ChatUnread"],
    }),

    // Pass a `shift_id` for a per-shift unread badge; omit for the global total.
    getChatUnreadCount: build.query<number, { shift_id?: string } | void>({
      query: (args) => ({
        url: "/chat/unread-count",
        method: "GET",
        params: cleanParams(args ?? {}),
      }),
      transformResponse: (res: ApiEnvelope<{ unread_count: number }>) => res.data.unread_count,
      providesTags: ["ChatUnread"],
    }),
  }),
});

/** Drops undefined/empty values so the URL only carries real params. */
function cleanParams(args: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== "") out[key] = value as string | number;
  }
  return out;
}

export const {
  useOpenConversationMutation,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkConversationReadMutation,
  useGetChatUnreadCountQuery,
} = chatApi;
