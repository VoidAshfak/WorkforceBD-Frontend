"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileEdit,
  Hourglass,
  Loader2,
  MapPin,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

import CancelShiftSheet from "@/components/business/CancelShiftSheet";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  useGetBusinessDashboardQuery,
  useGetBusinessShiftsQuery,
} from "@/store/api/businessApi";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import type { BusinessShift } from "@/types/business";

/**
 * Visual treatment per shift status. `accent` paints the card's left rail; the
 * pill uses `className`. Any status not listed falls back to a neutral grey.
 */
const STATUS_UI: Record<
  string,
  { label: string; className: string; accent: string; icon: typeof Briefcase }
> = {
  draft: { label: "Draft", className: "bg-black/5 text-text-secondary", accent: "bg-text-tertiary", icon: FileEdit },
  pending_approval: {
    label: "Under review",
    className: "bg-warning/20 text-text-muted",
    accent: "bg-warning",
    icon: Hourglass,
  },
  published: { label: "Live", className: "bg-emerald/10 text-emerald", accent: "bg-emerald", icon: PlayCircle },
  applications_open: { label: "Live", className: "bg-emerald/10 text-emerald", accent: "bg-emerald", icon: PlayCircle },
  worker_selected: { label: "Hiring", className: "bg-sky/15 text-sky", accent: "bg-sky", icon: Users },
  worker_confirmed: { label: "Staffed", className: "bg-sky/15 text-sky", accent: "bg-sky", icon: Users },
  checked_in: { label: "Running", className: "bg-brand/25 text-text-muted", accent: "bg-brand", icon: PlayCircle },
  active: { label: "Running", className: "bg-brand/25 text-text-muted", accent: "bg-brand", icon: PlayCircle },
  completed: { label: "Completed", className: "bg-emerald/10 text-emerald", accent: "bg-emerald", icon: CheckCircle2 },
  paid: { label: "Paid", className: "bg-emerald/10 text-emerald", accent: "bg-emerald", icon: CheckCircle2 },
  closed: { label: "Closed", className: "bg-black/5 text-text-secondary", accent: "bg-text-tertiary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", className: "bg-danger/10 text-danger", accent: "bg-danger", icon: XCircle },
};

/** Statuses that can no longer be cancelled (preview would 409). */
const TERMINAL = new Set(["completed", "payment_pending", "paid", "closed", "cancelled"]);

function statusUi(status: string) {
  return (
    STATUS_UI[status] ?? {
      label: status.replace(/_/g, " "),
      className: "bg-black/5 text-text-secondary",
      accent: "bg-text-tertiary",
      icon: Briefcase,
    }
  );
}

/**
 * Filter pills. `value: undefined` is the "All" tab; the rest map to a single
 * backend shift status (`GET /business/shifts?status=`). "Live" filters to
 * `published` — the common open state — while "All" surfaces every stage.
 */
const TABS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "published", label: "Live" },
  { value: "pending_approval", label: "Under review" },
  { value: "worker_selected", label: "Hiring" },
  { value: "worker_confirmed", label: "Staffed" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Drafts" },
];

/**
 * Business Activity — the poster's shift tracker. Lists the business's own
 * shifts with live staffing counters and status, filterable by stage and
 * paginated, newest first. Tapping a card opens the owned-shift detail.
 * Shown on `/activity` when `activeRole === "business"`.
 */
export default function BusinessActivity() {
  const router = useRouter();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<BusinessShift | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useGetBusinessShiftsQuery({
    status,
    page,
    limit: 10,
  });
  const dashboard = useGetBusinessDashboardQuery();

  const changeFilter = (next: string | undefined) => {
    setStatus(next);
    setPage(1);
  };

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;
  const d = dashboard.data;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-5 pt-4">
      {/* Branded backdrop, matched to the worker activity feed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-light/60 via-background to-background"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-brand/25 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-20 top-24 -z-10 h-48 w-48 rounded-full bg-sky/15 blur-3xl"
      />

      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">Activity</h1>
          <p className="text-[13px] text-text-secondary">
            {d
              ? `${d.active_shifts} active · ${d.applicants_waiting} applicant${d.applicants_waiting === 1 ? "" : "s"} waiting`
              : "Every shift you've posted, in one place."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/shifts/new")}
          className="flex shrink-0 items-center gap-1.5 rounded-pill bg-ink px-3.5 py-2 text-[13px] font-bold text-white active:scale-95"
        >
          <Plus size={15} strokeWidth={2.6} /> Post
        </button>
      </header>

      <div className="-mx-5 mt-3 flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const isActive = tab.value === status;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => changeFilter(tab.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                isActive
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-text-secondary hover:border-ink/30"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <ListSkeleton />
        ) : isError && items.length === 0 ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState filtered={Boolean(status)} onCreate={() => router.push("/shifts/new")} />
        ) : (
          <div className="space-y-3">
            {items.map((s, i) => (
              <ShiftCard
                key={s.id}
                shift={s}
                index={i}
                onClick={() => router.push(`/shifts/${s.id}`)}
                onRequestDelete={TERMINAL.has(s.status) ? undefined : () => setCancelTarget(s)}
              />
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

      {/* Transient confirmation after a successful delete. */}
      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-5">
          <span className="pointer-events-auto rounded-pill bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
            {toast}
          </span>
        </div>
      ) : null}

      <CancelShiftSheet
        open={Boolean(cancelTarget)}
        shiftId={cancelTarget?.id ?? null}
        shiftTitle={cancelTarget?.title ?? ""}
        onClose={() => setCancelTarget(null)}
        onDeleted={(message) => {
          setCancelTarget(null);
          setToast(message);
          window.setTimeout(() => setToast(null), 3000);
        }}
      />
    </div>
  );
}

/** Pixels of left-swipe that expose the delete zone / trip the confirm. */
const SWIPE_REVEAL = 96;
const SWIPE_TRIGGER = 64;

function ShiftCard({
  shift,
  index,
  onClick,
  onRequestDelete,
}: {
  shift: BusinessShift;
  index: number;
  onClick: () => void;
  /** Undefined when the shift is in a terminal state — swipe-to-delete disabled. */
  onRequestDelete?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const ui = statusUi(shift.status);
  const StatusIcon = ui.icon;
  const waiting = shift.applicants_waiting;
  const swipeable = Boolean(onRequestDelete);

  // Horizontal swipe-to-delete. `dx` drives the visible transform; `dxRef`
  // mirrors it so the pointer-up handler reads the latest value without a stale
  // closure, and `moved` suppresses the tap-navigation after a real drag.
  const [dx, setDx] = useState(0);
  // `dragActive` (state) only styles the transform transition; `dragging` (ref)
  // gates the handler logic synchronously within a gesture.
  const [dragActive, setDragActive] = useState(false);
  const dxRef = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  const slide = (v: number) => {
    dxRef.current = v;
    setDx(v);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeable) return;
    startX.current = e.clientX;
    dragging.current = true;
    moved.current = false;
    setDragActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (delta < -4) moved.current = true;
    slide(Math.max(-SWIPE_REVEAL, Math.min(0, delta)));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setDragActive(false);
    if (dxRef.current <= -SWIPE_TRIGGER) onRequestDelete?.();
    slide(0);
  };

  const handleClick = () => {
    // Swallow the click that fires at the end of a drag.
    if (moved.current) {
      moved.current = false;
      return;
    }
    onClick();
  };

  // Entrance: slide + fade up, staggered by list position (capped).
  useGSAP(
    () => {
      gsap.from(cardRef.current, {
        y: 18,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power3.out",
        delay: Math.min(index, 8) * 0.05,
      });
    },
    { scope: cardRef },
  );

  return (
    <div ref={cardRef} className="relative overflow-hidden rounded-3xl">
      {/* Delete zone, revealed only while the card is dragged left (hidden at
          rest so it never peeks through the card's rounded corners). */}
      {swipeable && dx < 0 ? (
        <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-r-3xl bg-danger text-white">
          <span
            className="flex flex-col items-center gap-1 text-[11px] font-bold transition-transform"
            style={{ transform: `scale(${dx <= -SWIPE_TRIGGER ? 1.1 : 0.9})` }}
          >
            <Trash2 size={20} /> Cancel
          </span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        className={`relative block w-full rounded-3xl border border-brand/30 bg-gradient-to-br from-brand-light via-surface to-brand/25 p-4 pl-5 text-left shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)] active:scale-[0.99] hover:shadow-[0_16px_36px_-22px_rgba(0,0,0,0.55)] ${
          dragActive ? "" : "transition-transform"
        }`}
      >
      {/* Status accent rail */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${ui.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{shift.title}</p>
          {shift.categories ? (
            <p className="truncate text-[12px] text-text-secondary">{shift.categories.name}</p>
          ) : null}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${ui.className}`}
        >
          <StatusIcon size={12} />
          {ui.label}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
        <FactChip icon={CalendarDays} value={formatShiftDate(shift.shift_date)} />
        <FactChip icon={Clock} value={formatTimeRange(shift.start_time, shift.end_time)} />
        {shift.zones ? <FactChip icon={MapPin} value={shift.zones.name} /> : null}
        <span className="ml-auto rounded-lg bg-brand/20 px-2.5 py-1 text-[13px] font-extrabold text-ink">
          {formatTaka(shift.pay_amount)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          <Users size={12} /> {shift.filled}/{shift.capacity} hired
        </span>
        {waiting > 0 ? (
          <span className="rounded-full bg-sky/10 px-2.5 py-1 text-[11px] font-bold text-sky">
            {waiting} waiting
          </span>
        ) : shift.is_full ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2.5 py-1 text-[11px] font-bold text-emerald">
            <CheckCircle2 size={12} /> Fully staffed
          </span>
        ) : null}
      </div>
      </button>
    </div>
  );
}

/** Small rounded fact chip (date / time / location) inside a card. */
function FactChip({ icon: Icon, value }: { icon: typeof Clock; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-black/[0.04] px-2 py-1">
      <Icon size={13} className="shrink-0 text-text-tertiary" />
      <span className="truncate">{value}</span>
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-2/3 rounded bg-black/[0.08]" />
            <div className="h-5 w-16 rounded-full bg-black/[0.06]" />
          </div>
          <div className="mt-4 flex gap-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-6 w-20 rounded-lg bg-black/[0.06]" />
            ))}
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
      <p className="max-w-xs text-[14px] text-text-secondary">Couldn&apos;t load your shifts. Please try again.</p>
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

function EmptyState({ filtered, onCreate }: { filtered: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <Briefcase size={22} className="text-ink" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">
        {filtered
          ? "No shifts in this stage yet."
          : "You haven't posted any shifts yet. Create one to start hiring — it'll show up here."}
      </p>
      {!filtered ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-1 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white active:scale-95"
        >
          Create a shift
        </button>
      ) : null}
    </div>
  );
}
