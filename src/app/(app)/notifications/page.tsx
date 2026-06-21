"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  CheckCheck,
  CheckCircle2,
  Megaphone,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  useGetNotificationsQuery,
  useMarkAllReadMutation,
  useMarkReadMutation,
} from "@/store/api/notificationsApi";
import { formatRelativeTime } from "@/lib/format";
import type { AppNotification } from "@/types/notification";

/**
 * Notifications feed (Screens 11–12). Newest first, unread highlighted. Tapping
 * a row marks it read and deep-links by `data.kind`. The badge stays in sync via
 * the shared RTK Query cache + the header bell's polling.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetNotificationsQuery({ page, limit: 20 });
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const items = data?.items ?? [];
  const unread = data?.unread_count ?? 0;
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  return (
    <div className="flex min-h-full flex-col px-6 pt-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 text-2xl font-bold text-ink">Notifications</h1>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead()}
            disabled={markingAll}
            className="flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-[13px] font-semibold text-ink active:scale-95 disabled:opacity-50"
          >
            <CheckCheck size={15} /> Mark all
          </button>
        ) : null}
      </header>

      <div className="flex-1 pt-4 pb-6">
        {isLoading ? (
          <FeedSkeleton />
        ) : items.length > 0 ? (
          <>
            <ul className="flex flex-col gap-2">
              {items.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </ul>
            {hasMore ? (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="mx-auto mt-5 block rounded-full bg-black/5 px-5 py-2.5 text-[14px] font-semibold text-ink active:scale-95 disabled:opacity-50"
              >
                {isFetching ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const [markRead] = useMarkReadMutation();
  const { icon: Icon, tone } = visualFor(notification);

  const onOpen = () => {
    if (!notification.is_read) markRead(notification.id);
    const href = linkFor(notification);
    if (href) router.push(href);
  };

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors active:scale-[0.99] ${
          notification.is_read ? "border-border bg-surface" : "border-brand/40 bg-brand-light/40"
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="flex-1 truncate text-[14px] font-bold text-ink">
              {notification.title}
            </span>
            <span className="shrink-0 text-[12px] text-text-tertiary">
              {formatRelativeTime(notification.created_at)}
            </span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-5 text-text-secondary">
            {notification.body}
          </span>
        </span>
        {!notification.is_read ? (
          <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-dark" />
        ) : null}
      </button>
    </li>
  );
}

/** Icon + color tint by notification kind / decision status. */
function visualFor(n: AppNotification): { icon: LucideIcon; tone: string } {
  const kind = n.data?.kind;
  const status = n.data?.status;

  if (kind === "verification_decision") {
    return status === "rejected"
      ? { icon: XCircle, tone: "bg-danger/10 text-danger" }
      : { icon: BadgeCheck, tone: "bg-sky/10 text-sky" };
  }
  if (kind === "application_decision") {
    return status === "rejected"
      ? { icon: XCircle, tone: "bg-danger/10 text-danger" }
      : { icon: CheckCircle2, tone: "bg-emerald/10 text-emerald" };
  }
  if (kind === "shift_moderation") {
    return { icon: Megaphone, tone: "bg-warning/20 text-text-muted" };
  }
  return { icon: Bell, tone: "bg-black/5 text-ink" };
}

/** Deep-link target for a tapped notification, or null to stay put. */
function linkFor(n: AppNotification): string | null {
  const shiftId = typeof n.data?.shift_id === "string" ? n.data.shift_id : null;
  switch (n.data?.kind) {
    case "verification_decision":
      return "/profile";
    case "application_decision":
      return shiftId ? `/shifts/${shiftId}` : "/activity";
    case "shift_moderation":
      return shiftId ? `/shifts/${shiftId}` : null;
    default:
      return null;
  }
}

function FeedSkeleton() {
  return (
    <ul className="flex animate-pulse flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
          <span className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 rounded bg-black/[0.06]" />
            <div className="h-2.5 w-full rounded bg-black/[0.06]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <Bell size={22} className="text-ink" />
      </span>
      <p className="text-[15px] font-semibold text-ink">You&apos;re all caught up</p>
      <p className="max-w-xs text-[13px] text-text-secondary">
        Hiring decisions, verification updates, and shift news will show up here.
      </p>
    </div>
  );
}
