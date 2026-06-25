"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Loader2, SendHorizonal } from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import {
  useGetMessagesQuery,
  useMarkConversationReadMutation,
  useSendMessageMutation,
} from "@/store/api/chatApi";
import { formatInstantTime, formatShiftDate } from "@/lib/format";
import type { ChatMessage } from "@/types/chat";

/**
 * Full-screen chat thread for a per-shift worker⇄business conversation. History
 * comes from REST (newest-first, paginated "load earlier"); live messages + read
 * receipts arrive over Socket.IO and are folded into the same cache. Optimistic
 * send keeps it snappy. Mounted by /chat/[id].
 */
export default function ChatThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, isFetching } = useGetMessagesQuery({
    id: conversationId,
    page,
    limit: 30,
  });
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();

  const convo = data?.conversation;
  const side = convo?.side ?? "worker";
  const items = useMemo(() => data?.items ?? [], [data]);
  // API returns newest-first; render oldest→newest.
  const ordered = useMemo(() => [...items].reverse(), [items]);
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;
  const newest = items[0];

  // Pin to the latest message when the thread grows (mount, send, live receive).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [ordered.length]);

  // Mark incoming as read when a counterpart message lands while we're viewing.
  useEffect(() => {
    if (newest && newest.sender_role !== side) markRead(conversationId);
  }, [newest, side, conversationId, markRead]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    try {
      await sendMessage({ id: conversationId, body }).unwrap();
    } catch {
      // Optimistic patch is rolled back by the mutation; restore the text.
      setDraft(body);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        {convo ? (
          <>
            <BusinessAvatar name={convo.counterpart.name} logo={convo.counterpart.avatar} size={38} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[15px] font-bold text-ink">
                <span className="truncate">{convo.counterpart.name}</span>
                <BadgeCheck size={14} className="shrink-0 text-sky" />
              </p>
              <p className="truncate text-[12px] text-text-secondary">
                {convo.shift.title} · {formatShiftDate(convo.shift.shift_date)}
              </p>
            </div>
          </>
        ) : (
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-black/[0.05]" />
        )}
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={22} className="animate-spin text-ink/40" />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-[14px] text-text-secondary">
            Couldn&apos;t load this conversation.
          </p>
        ) : ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-[15px] font-semibold text-ink">Start the conversation</p>
            <p className="max-w-xs text-[13px] text-text-secondary">
              Ask about timing, dress code, or anything you need before the shift.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {hasMore ? (
              <button
                type="button"
                disabled={isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="mx-auto mb-1 flex items-center gap-1.5 rounded-full bg-black/5 px-4 py-1.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
              >
                {isFetching ? <Loader2 size={13} className="animate-spin" /> : null} Load earlier
              </button>
            ) : null}
            {ordered.map((m, i) => (
              <Bubble key={m.id} message={m} mine={m.sender_role === side} showReceipt={i === ordered.length - 1} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-surface px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="Message…"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-[14px] text-ink outline-none focus:border-sky"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity active:scale-95 disabled:opacity-40"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  message,
  mine,
  showReceipt,
}: {
  message: ChatMessage;
  mine: boolean;
  showReceipt: boolean;
}) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-5 ${
          mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-surface text-ink shadow-sm"
        }`}
      >
        {message.body}
      </div>
      <span className="mt-0.5 px-1 text-[10px] text-text-tertiary">
        {formatInstantTime(message.created_at)}
        {mine && showReceipt ? (message.read_at ? " · Seen" : " · Sent") : ""}
      </span>
    </div>
  );
}
