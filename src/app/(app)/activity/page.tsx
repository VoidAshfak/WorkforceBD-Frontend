"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

import BusinessActivity from "@/components/business/BusinessActivity";
import CheckInSheet from "@/components/shifts/CheckInSheet";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAppSelector } from "@/store/hooks";
import {
  useCheckOutMutation,
  useGetApplicationsQuery,
  useGetApplicationsSummaryQuery,
  useWithdrawApplicationMutation,
} from "@/store/api/shiftsApi";
import { formatInstantTime, formatRelativeTime, formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { deriveAttendance } from "@/lib/attendance";
import type {
  ActivityStatus,
  Application,
  ApplicationStatus,
  CompletionStatus,
} from "@/types/shift";

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * Visual treatment per application status: `className` styles the badge pill,
 * `accent` paints the card's left status rail, `ring` tints the avatar ring.
 */
const STATUS_UI: Record<
  ApplicationStatus,
  { label: string; className: string; accent: string; ring: string; icon: typeof BadgeCheck }
> = {
  pending: {
    label: "Pending",
    className: "bg-warning/20 text-text-muted",
    accent: "bg-warning",
    ring: "ring-warning/40",
    icon: Hourglass,
  },
  shortlisted: {
    label: "Shortlisted",
    className: "bg-sky/15 text-sky",
    accent: "bg-sky",
    ring: "ring-sky/40",
    icon: Star,
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald/10 text-emerald",
    accent: "bg-emerald",
    ring: "ring-emerald/50",
    icon: BadgeCheck,
  },
  rejected: {
    label: "Not selected",
    className: "bg-danger/10 text-danger",
    accent: "bg-danger",
    ring: "ring-danger/40",
    icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-black/5 text-text-secondary",
    accent: "bg-text-tertiary",
    ring: "ring-black/10",
    icon: XCircle,
  },
  no_show: {
    label: "No show",
    className: "bg-danger/10 text-danger",
    accent: "bg-danger",
    ring: "ring-danger/40",
    icon: UserX,
  },
};

/** Tracker filter pills — `value: undefined` is the "All" tab. */
const TABS: { value: ApplicationStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Not selected" },
  { value: "withdrawn", label: "Withdrawn" },
];

/** Withdrawal is allowed by the backend only in these states. */
const WITHDRAWABLE: ApplicationStatus[] = ["pending", "shortlisted"];

type PillUI = { label: string; tone: string; icon: typeof CheckCircle2 };

/**
 * Status pill for a shift past check-out, driven by the blended `activity_status`
 * (falling back to `completion_status`). Returns `null` while the worker is still
 * pre-checkout, so the inline check-in/out actions stay in control.
 */
function handshakePill(
  activity: ActivityStatus | undefined,
  completion: CompletionStatus | null,
  checkedOut: boolean,
): PillUI | null {
  const paid =
    activity === "completed" || completion === "confirmed" || completion === "resolved";
  if (paid) return { label: "Paid", tone: "bg-emerald/10 text-emerald", icon: CheckCircle2 };
  if (activity === "disputed" || completion === "disputed")
    return { label: "Disputed", tone: "bg-warning/15 text-text-muted", icon: ShieldAlert };
  if (activity === "confirm_needed" || completion === "business_done")
    return { label: "Confirm pay", tone: "bg-brand text-ink", icon: UserCheck };
  if (activity === "awaiting_confirmation" || completion === "worker_done" || checkedOut)
    return { label: "Awaiting confirm", tone: "bg-sky/10 text-sky", icon: Hourglass };
  return null;
}

/**
 * Activity — role-aware tracker. Workers see their application tracker; business
 * accounts see the shifts they've posted (see {@link BusinessActivity}).
 */
export default function ActivityPage() {
  const { activeRole } = useAppSelector((s) => s.auth);

  if (activeRole === "business") return <BusinessActivity />;

  return <WorkerActivity />;
}

function WorkerActivity() {
  const [status, setStatus] = useState<ApplicationStatus | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useGetApplicationsQuery({
    status,
    page,
    limit: 10,
  });
  const { data: summary } = useGetApplicationsSummaryQuery();

  const changeFilter = (next: ApplicationStatus | undefined) => {
    setStatus(next);
    setPage(1);
  };

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  /** Count shown on a filter pill — total for "All", else the per-status count. */
  const tabCount = (value: ApplicationStatus | undefined): number | undefined => {
    if (!summary) return undefined;
    return value ? summary.applications.by_status[value] : summary.applications.total;
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-5 pt-4">
      {/* Decorative branded backdrop — warm gradient wash + soft blobs so the
          cards float above a lively surface instead of flat background. */}
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

      <header className="shrink-0">
        <h1 className="text-xl font-bold text-ink">Activity</h1>
        <p className="text-[13px] text-text-secondary">
          {summary && summary.applications.active > 0
            ? `${summary.applications.active} active application${summary.applications.active === 1 ? "" : "s"}.`
            : "Track every shift you've applied to."}
        </p>
      </header>

      <div className="-mx-5 mt-3 flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const isActive = tab.value === status;
          const count = tabCount(tab.value);
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => changeFilter(tab.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                isActive
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-text-secondary hover:border-ink/30"
              }`}
            >
              {tab.label}
              {count ? (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-black/[0.06] text-text-secondary"
                  }`}
                >
                  {count}
                </span>
              ) : null}
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
          <EmptyState filtered={Boolean(status)} />
        ) : (
          <div className="space-y-3">
            {items.map((app, i) => (
              <ApplicationCard key={app.id} app={app} index={i} />
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

function ApplicationCard({ app, index }: { app: Application; index: number }) {
  const router = useRouter();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [withdraw, { isLoading: withdrawing }] = useWithdrawApplicationMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  // Attendance is tracked locally only for optimistic post-action updates; the
  // baseline comes from `deriveAttendance` (the raw stamps aren't reliably sent,
  // so a mid-shift worker must not fall back to "Check in"). The card stays
  // mounted across list refetches, so the local override survives them.
  const [checkedInAt, setCheckedInAt] = useState<string | null>(app.checked_in_at ?? null);
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(app.checked_out_at ?? null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const shift = app.shifts;
  const badge = STATUS_UI[app.status];
  const BadgeIcon = badge.icon;
  const canWithdraw = WITHDRAWABLE.includes(app.status);
  const isAccepted = app.status === "accepted";

  const derived = deriveAttendance(app);
  const isCheckedIn = checkedInAt !== null || derived.checkedIn;
  const isCheckedOut = checkedOutAt !== null || derived.checkedOut;

  // Once the worker is past check-out, the completion handshake owns the state.
  // Show a status pill (the worker acts on it in the detail screen) instead of
  // the inline check-in/out actions.
  const handshake = handshakePill(app.activity_status, app.completion_status ?? null, isCheckedOut);

  // Entrance: slide + fade up, staggered by list position (capped) so the feed
  // cascades in. Mount-only — cards persisting across filters don't re-animate.
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

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const onWithdraw = (e: React.MouseEvent) => {
    stop(e);
    setConfirmWithdraw(true);
  };

  const doWithdraw = async () => {
    try {
      await withdraw(app.id).unwrap();
    } catch {
      // List stays as-is; the row keeps its current status on failure.
    } finally {
      setConfirmWithdraw(false);
    }
  };

  const onCheckIn = (e: React.MouseEvent) => {
    stop(e);
    setActionError(null);
    setCheckInOpen(true);
  };

  const onCheckOut = async (e: React.MouseEvent) => {
    stop(e);
    setActionError(null);
    try {
      const res = await checkOut(app.id).unwrap();
      setCheckedOutAt(res.checked_out_at);
    } catch (err) {
      setActionError(errMessage(err, "Check-out failed. Try again."));
    }
  };

  return (
    <>
    <button
      ref={cardRef}
      type="button"
      onClick={() => router.push(`/shifts/${shift.id}`)}
      className="relative block w-full overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand-light via-surface to-brand/25 p-4 pl-5 text-left shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)] transition-shadow active:scale-[0.99] hover:shadow-[0_16px_36px_-22px_rgba(0,0,0,0.55)]"
    >
      {/* Status accent rail */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${badge.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`shrink-0 rounded-full p-0.5 ring-2 ${badge.ring}`}>
            <BusinessAvatar name={shift.business_profiles.business_name} logo={shift.business_profiles.logo_url} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-ink">{shift.title}</p>
            <p className="truncate text-[12px] text-text-secondary">
              {shift.business_profiles.business_name}
            </p>
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}
        >
          <BadgeIcon size={12} />
          {badge.label}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
        <FactChip icon={CalendarDays} value={formatShiftDate(shift.shift_date)} />
        <FactChip icon={Clock} value={formatTimeRange(shift.start_time, shift.end_time)} />
        <FactChip icon={MapPin} value={shift.zones?.name ?? "Location TBA"} />
        <span className="ml-auto rounded-lg bg-brand/20 px-2.5 py-1 text-[13px] font-extrabold text-ink">
          {formatTaka(shift.pay_amount)}
        </span>
      </div>

      {/* Backend-authored contextual line (e.g. "You got this shift! …"). */}
      {app.message ? (
        <p className="mt-2.5 text-[12px] font-medium leading-snug text-ink/75">{app.message}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <span className="min-w-0 truncate text-[11px] text-text-tertiary">
          {isCheckedIn
            ? checkedInAt
              ? `Checked in ${formatInstantTime(checkedInAt)}`
              : "On shift"
            : `Applied ${formatRelativeTime(app.applied_at)}`}
        </span>

        {/* Past check-out → handshake status pill (act in detail). Otherwise the
            live-attendance actions; pending/shortlisted can withdraw. */}
        {handshake ? (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold ${handshake.tone}`}
          >
            <handshake.icon size={13} /> {handshake.label}
          </span>
        ) : isAccepted ? (
          isCheckedIn ? (
            <AttendanceAction
              onClick={onCheckOut}
              loading={checkingOut}
              icon={LogOut}
              label="Check out"
              tone="bg-ink text-white"
            />
          ) : (
            <AttendanceAction
              onClick={onCheckIn}
              loading={false}
              icon={LogIn}
              label="Check in"
              tone="bg-brand text-ink"
            />
          )
        ) : canWithdraw ? (
          <AttendanceAction
            onClick={onWithdraw}
            loading={withdrawing}
            icon={XCircle}
            label="Withdraw"
            tone="bg-black/5 text-danger"
          />
        ) : null}
      </div>

      {actionError ? <p className="mt-2 text-[12px] font-medium text-danger">{actionError}</p> : null}
    </button>

    <ConfirmSheet
      open={confirmWithdraw}
      onClose={() => setConfirmWithdraw(false)}
      onConfirm={doWithdraw}
      title="Withdraw this application?"
      description="This is permanent — you can't apply to this shift again."
      confirmLabel="Withdraw"
      cancelLabel="Keep it"
      tone="danger"
      loading={withdrawing}
      icon={XCircle}
    />

    <CheckInSheet
      open={checkInOpen}
      onClose={() => setCheckInOpen(false)}
      applicationId={app.id}
      onCheckedIn={(at) => setCheckedInAt(at)}
    />
    </>
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

/** Pill action inside a card (a span, so it doesn't nest a button in a button). */
function AttendanceAction({
  onClick,
  loading,
  icon: Icon,
  label,
  tone,
}: {
  onClick: (e: React.MouseEvent) => void;
  loading: boolean;
  icon: typeof LogIn;
  label: string;
  tone: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(e as unknown as React.MouseEvent);
      }}
      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold active:scale-95 ${tone}`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {label}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-full bg-black/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-black/[0.08]" />
              <div className="h-3 w-1/3 rounded bg-black/[0.06]" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="h-3.5 rounded bg-black/[0.06]" />
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
      <p className="max-w-xs text-[14px] text-text-secondary">
        Couldn&apos;t load your applications. Please try again.
      </p>
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

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <Sparkles size={22} className="text-ink" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">
        {filtered
          ? "No applications in this status yet."
          : "You haven't applied to any shifts yet. Find one on Home and apply — it'll show up here. ✨"}
      </p>
    </div>
  );
}
