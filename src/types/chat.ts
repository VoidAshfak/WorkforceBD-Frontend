/** Chat shapes (see /docs/api-guidelines.md → Chat). Per-(shift, worker) threads. */

import type { Pagination } from "@/types/shift";

export type ChatRole = "worker" | "business";

/** A single message in a conversation. */
export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_role: ChatRole;
  body: string;
  /** Null until the recipient reads it. */
  read_at: string | null;
  created_at: string;
};

/** A conversation from the viewer's perspective. */
export type Conversation = {
  id: string;
  /** The caller's role in this thread. */
  side: ChatRole;
  shift: { id: string; title: string; shift_date: string };
  counterpart: { type: ChatRole; id: string; name: string; avatar: string | null };
  last_message: { text: string; at: string; sender_role: ChatRole } | null;
  unread_count: number;
  created_at: string;
};

/** Message history page, with the parent conversation embedded. */
export type MessagesPage = {
  conversation: Conversation;
  items: ChatMessage[];
  pagination: Pagination;
};
