"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import { formatRelativeTime } from "@/lib/format";
import type { Conversation } from "@/types/chat";

/**
 * Chat inbox — every per-shift conversation the worker is in, most-recent first.
 * Live previews/unread counts ride the Socket.IO bridge (which invalidates the
 * `ChatInbox` tag); focus/poll refetch backfills. Tap a row to open the thread.
 */
export default function ChatInboxPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useGetConversationsQuery(
    { page, limit: 20 },
    { refetchOnFocus: true, refetchOnReconnect: true },
  );

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  return (
    <div className="flex h-full flex-col px-5 pt-4">
      <header className="shrink-0">
        <h1 className="text-xl font-bold text-ink">Messages</h1>
        <p className="text-[13px] text-text-secondary">Your shift conversations with businesses.</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <ListSkeleton />
        ) : isError && items.length === 0 ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <ConversationRow key={c.id} convo={c} />
            ))}

            {hasMore ? (
              <button
                type="button"
                disabled={isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink active:scale-[0.99] disabled:opacity-50"
              >
                {isFetching ? <Loader2 size={16} className="animate-spin" /> : null}
                {isFetching ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ convo }: { convo: Conversation }) {
  const router = useRouter();
  const unread = convo.unread_count > 0;
  const preview = convo.last_message?.text ?? "No messages yet";
  const sentByMe = convo.last_message?.sender_role === convo.side;

  return (
    <button
      type="button"
      onClick={() => router.push(`/chat/${convo.id}`)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.99]"
    >
      <BusinessAvatar name={convo.counterpart.name} logo={convo.counterpart.avatar} size={46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-ink">{convo.counterpart.name}</p>
          {convo.last_message ? (
            <span className="shrink-0 text-[11px] text-text-tertiary">
              {formatRelativeTime(convo.last_message.at)}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[12px] text-text-tertiary">{convo.shift.title}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`truncate text-[13px] ${unread ? "font-semibold text-ink" : "text-text-secondary"}`}>
            {sentByMe ? "You: " : ""}
            {preview}
          </p>
          {unread ? (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
              {convo.unread_count > 9 ? "9+" : convo.unread_count}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className="h-[46px] w-[46px] rounded-full bg-black/[0.06]" />
          <div className="flex-1 space-y-2">
            <span className="block h-3.5 w-1/2 rounded bg-black/[0.08]" />
            <span className="block h-3 w-2/3 rounded bg-black/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15">
        <RefreshCw size={20} className="text-text-muted" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">Couldn&apos;t load your messages.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white active:scale-95"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <MessageCircle size={22} className="text-ink" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">
        No conversations yet. Open a shift you&apos;ve applied to and tap{" "}
        <span className="font-semibold text-ink">Chat with business</span> to start one. 💬
      </p>
    </div>
  );
}
