"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Star,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";
import RoadmapBar from "@/components/shifts/RoadmapBar";
import {
  useBulkDecideApplicantsMutation,
  useDecideApplicantMutation,
  useGetBusinessShiftQuery,
  useGetShiftApplicantsQuery,
} from "@/store/api/businessApi";
import {
  useGetChatUnreadCountQuery,
  useOpenConversationMutation,
} from "@/store/api/chatApi";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { createLogger } from "@/lib/logger";
import type { Applicant, ApplicantDecision, BusinessShiftDetail as Shift } from "@/types/business";

const log = createLogger("biz-shift-detail");

// MapLibre is browser-only — the location map must not server-render.
const ShiftLocationMap = dynamic(() => import("@/components/business/ShiftLocationMap"), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-card bg-black/[0.05]" />,
});

type Tab = "details" | "applicants";

/**
 * Business view of an owned ("created") shift — its summary plus an applicant
 * tracker. Reached at `/shifts/:id` when the active role is `business`. Apply
 * notifications (`new_applicant`) deep-link here with `?tab=applicants`; each
 * applicant row carries reputation, hire/shortlist/reject actions, and a message
 * shortcut that opens the per-shift chat thread.
 */
export default function BusinessShiftDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "applicants" ? "applicants" : "details");

  // Shift `status` auto-advances server-side as the shift progresses (hire →
  // check-in → complete). Refetch on remount and window refocus so the journey
  // bar (`roadmap`) reflects the live status without a manual reload.
  const { data: shift, isLoading, isError } = useGetBusinessShiftQuery(id, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const unread = useGetChatUnreadCountQuery({ shift_id: id });

  if (isLoading) return <Skeleton onBack={() => router.back()} />;
  if (isError || !shift) {
    return (
      <div className="flex h-full flex-col px-6 pt-6">
        <BackBar onBack={() => router.back()} title="Shift" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-[15px] font-semibold text-ink">Shift not found</p>
          <p className="text-[14px] text-text-secondary">It may have been removed.</p>
          <Button variant="secondary" onClick={() => router.replace("/")} className="mt-2">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-5 pt-5">
      <BackBar onBack={() => router.back()} title={shift.title} status={shift.status} />

      <Tabs
        tab={tab}
        onChange={setTab}
        waiting={shift.applicants_waiting}
        unread={unread.data ?? 0}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab === "details" ? (
          <Details shift={shift} />
        ) : (
          <ApplicantsTab shiftId={id} capacityFull={shift.is_full} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Header --------------------------------- */

function BackBar({ onBack, title, status }: { onBack: () => void; title: string; status?: string }) {
  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">{title}</h1>
      {status ? <StatusPill status={status} /> : null}
    </header>
  );
}

function StatusPill({ status }: { status: string }) {
  const open = status === "published" || status === "applications_open";
  const review = status === "pending_approval";
  const cls = open
    ? "bg-emerald/10 text-emerald"
    : review
      ? "bg-warning/20 text-text-muted"
      : "bg-black/[0.06] text-text-tertiary";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {open ? "Live" : status.replace(/_/g, " ")}
    </span>
  );
}

function Tabs({
  tab,
  onChange,
  waiting,
  unread,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  waiting: number;
  unread: number;
}) {
  return (
    <div className="mt-4 flex gap-2 rounded-full bg-black/[0.05] p-1">
      <TabButton active={tab === "details"} onClick={() => onChange("details")}>
        Details
      </TabButton>
      <TabButton active={tab === "applicants"} onClick={() => onChange("applicants")}>
        <span className="inline-flex items-center gap-1.5">
          Applicants
          {waiting > 0 ? (
            <span className="rounded-full bg-sky px-1.5 text-[11px] font-bold text-white">{waiting}</span>
          ) : null}
          {unread > 0 ? (
            <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="unread messages" />
          ) : null}
        </span>
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
        active ? "bg-surface text-ink shadow-sm" : "text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Details -------------------------------- */

function Details({ shift }: { shift: Shift }) {
  const cb = shift.cost_breakdown;
  const benefits = [
    shift.meal_included && "🍽️ Meal included",
    shift.transport_support && "🚌 Transport support",
    shift.uniform_provided && "👕 Uniform provided",
    shift.tips_expected && "💵 Tips expected",
  ].filter(Boolean) as string[];
  const requirements = [
    shift.experience_required && "🎯 Experience required",
    shift.customer_facing && "🙋 Customer-facing",
    ...(shift.languages ?? []).map((l) => `🗣️ ${l}`),
  ].filter(Boolean) as string[];
  const hasOnsite = shift.reporting_details || shift.dress_code || shift.manager_contact;

  return (
    <div className="space-y-4">
      {shift.roadmap ? (
        <div className="rounded-card border border-border bg-surface px-3 py-3.5">
          <RoadmapBar roadmap={shift.roadmap} />
        </div>
      ) : null}

      {shift.is_urgent || shift.is_large_request ? (
        <div className="flex flex-wrap gap-2">
          {shift.is_urgent ? <Badge tone="bg-danger/10 text-danger" label="🚨 Urgent" /> : null}
          {shift.is_large_request ? (
            <Badge tone="bg-brand-light text-text-muted" label={`👥 Large request · ${shift.capacity}`} />
          ) : null}
        </div>
      ) : null}

      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-text-secondary">Pay / worker</span>
          <span className="text-lg font-bold text-ink">{formatTaka(shift.pay_amount)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat icon={Users} label="Hired" value={`${shift.filled}/${shift.capacity}`} />
          <Stat icon={UserCheck} label="Waiting" value={String(shift.applicants_waiting)} />
        </div>
      </div>

      {/* Compensation breakdown */}
      {cb ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-2 text-[13px] font-semibold text-ink">Compensation</p>
          <div className="space-y-1.5 text-[13px]">
            <CostLine label={`Worker pay × ${cb.workers_needed}`} value={cb.total_worker_pay} />
            <CostLine label="Platform fee (10%)" value={cb.platform_fee} muted />
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="font-semibold text-ink">Total cost</span>
              <span className="font-bold text-ink">{formatTaka(cb.total_cost)}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-text-tertiary">
            {formatTaka(cb.total_worker_pay)} held now; the fee is charged later.
          </p>
        </div>
      ) : null}

      <InfoRow icon={CalendarDays} text={formatShiftDate(shift.shift_date)} />
      <InfoRow icon={Clock} text={formatTimeRange(shift.start_time, shift.end_time)} />
      {shift.categories ? <InfoRow icon={Star} text={shift.categories.name} /> : null}
      {shift.zones || shift.address ? (
        <InfoRow icon={MapPin} text={[shift.zones?.name, shift.address].filter(Boolean).join(" · ")} />
      ) : null}

      {shift.coordinates ? (
        <ShiftLocationMap
          key={`${shift.coordinates.latitude},${shift.coordinates.longitude}`}
          lat={shift.coordinates.latitude}
          lng={shift.coordinates.longitude}
        />
      ) : null}

      {shift.description ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-[13px] font-semibold text-ink">Details</p>
          <p className="mt-1 text-[14px] leading-6 text-text-secondary">{shift.description}</p>
        </div>
      ) : null}

      {benefits.length > 0 ? (
        <ChipSection title="Benefits" items={benefits} />
      ) : null}
      {requirements.length > 0 ? (
        <ChipSection title="Requirements" items={requirements} />
      ) : null}

      {hasOnsite ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-[13px] font-semibold text-ink">On-site</p>
          <div className="mt-1.5 space-y-1.5 text-[14px] leading-6 text-text-secondary">
            {shift.reporting_details ? <p>{shift.reporting_details}</p> : null}
            {shift.dress_code ? (
              <p>
                <span className="font-medium text-ink">Dress code:</span> {shift.dress_code}
              </p>
            ) : null}
            {shift.manager_contact ? (
              <p>
                <span className="font-medium text-ink">Manager:</span> {shift.manager_contact}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ tone, label }: { tone: string; label: string }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${tone}`}>{label}</span>
  );
}

function CostLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-text-tertiary" : "text-text-secondary"}>{label}</span>
      <span className={muted ? "text-text-secondary" : "font-semibold text-ink"}>{formatTaka(value)}</span>
    </div>
  );
}

function ChipSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((label) => (
          <Perk key={label} label={label} />
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.04] p-3">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-text-secondary">
        <Icon size={13} /> {label}
      </span>
      <p className="mt-1 text-[18px] font-bold text-ink">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <Icon size={17} className="shrink-0 text-text-tertiary" />
      <span className="text-[14px] text-ink">{text}</span>
    </div>
  );
}

function Perk({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-cream px-3 py-1.5 text-[12px] font-medium text-text-muted">{label}</span>
  );
}

/* ------------------------------ Applicants ------------------------------ */

function ApplicantsTab({ shiftId, capacityFull }: { shiftId: string; capacityFull: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, isError, refetch } = useGetShiftApplicantsQuery({
    shiftId,
    page,
  });
  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  // Bulk shortlist/reject — only still-decidable applicants can be selected.
  const decidableCount = items.filter(
    (a) => a.status === "pending" || a.status === "shortlisted",
  ).length;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, { isLoading: bulking }] = useBulkDecideApplicantsMutation();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
    setBulkError(null);
  };

  const runBulk = async (action: "shortlist" | "reject") => {
    if (selected.size === 0) return;
    setBulkError(null);
    try {
      await bulk({ shiftId, action, application_ids: [...selected] }).unwrap();
      exitSelect();
    } catch (err) {
      setBulkError((err as { data?: { message?: string } })?.data?.message ?? "Bulk action failed.");
    }
  };

  if (isLoading) return <ApplicantsSkeleton />;
  if (isError) {
    return (
      <button
        type="button"
        onClick={() => refetch()}
        className="mx-auto block rounded-full bg-black/5 px-5 py-2.5 text-[14px] font-semibold text-ink active:scale-95"
      >
        Couldn&apos;t load applicants — retry
      </button>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <Users size={22} className="text-ink" />
        </span>
        <p className="max-w-xs text-[13px] text-text-secondary">
          No applicants yet. You&apos;ll be notified the moment someone applies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decidableCount > 0 ? (
        <div className="flex items-center justify-between">
          {selecting ? (
            <>
              <button
                type="button"
                onClick={exitSelect}
                className="text-[13px] font-semibold text-text-secondary active:scale-95"
              >
                Cancel
              </button>
              <span className="text-[12px] font-medium text-text-tertiary">{selected.size} selected</span>
            </>
          ) : (
            <>
              <span className="text-[12px] font-medium text-text-tertiary">
                {decidableCount} awaiting decision
              </span>
              <button
                type="button"
                onClick={() => setSelecting(true)}
                className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold text-ink active:scale-95"
              >
                Select
              </button>
            </>
          )}
        </div>
      ) : null}

      {bulkError ? <p className="text-[12px] font-medium text-danger">{bulkError}</p> : null}

      <ul className="space-y-3">
        {items.map((a) => (
          <ApplicantRow
            key={a.id}
            applicant={a}
            shiftId={shiftId}
            capacityFull={capacityFull}
            selecting={selecting}
            selected={selected.has(a.id)}
            onToggle={() => toggle(a.id)}
          />
        ))}
        {hasMore ? (
          <li>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={isFetching}
              className="mx-auto block rounded-full bg-black/5 px-5 py-2.5 text-[14px] font-semibold text-ink active:scale-95 disabled:opacity-50"
            >
              {isFetching ? "Loading…" : "Load more"}
            </button>
          </li>
        ) : null}
      </ul>

      {/* Bulk action bar */}
      {selecting ? (
        <div className="sticky bottom-0 flex gap-2 rounded-full border border-border bg-surface p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => runBulk("reject")}
            disabled={bulking || selected.size === 0}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-danger/10 text-[13px] font-semibold text-danger active:scale-95 disabled:opacity-40"
          >
            <X size={15} /> Reject
          </button>
          <button
            type="button"
            onClick={() => runBulk("shortlist")}
            disabled={bulking || selected.size === 0}
            className="flex h-10 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-semibold text-white active:scale-95 disabled:opacity-40"
          >
            <Star size={15} /> Shortlist{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ApplicantRow({
  applicant,
  shiftId,
  capacityFull,
  selecting,
  selected,
  onToggle,
}: {
  applicant: Applicant;
  shiftId: string;
  capacityFull: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const w = applicant.worker_profiles;
  const [decide, { isLoading: deciding }] = useDecideApplicantMutation();
  const [openConversation, { isLoading: opening }] = useOpenConversationMutation();
  const [error, setError] = useState<string | null>(null);

  const pending = applicant.status === "pending";
  const shortlisted = applicant.status === "shortlisted";
  const actionable = pending || shortlisted;
  // Only still-decidable applicants can be bulk-selected.
  const selectable = selecting && actionable;

  const act = async (decision: ApplicantDecision) => {
    setError(null);
    try {
      await decide({ id: applicant.id, decision, shiftId }).unwrap();
    } catch (err) {
      setError((err as { data?: { message?: string } })?.data?.message ?? "Couldn't update.");
    }
  };

  const message = async () => {
    setError(null);
    try {
      const conv = await openConversation({ shift_id: shiftId, worker_profile_id: w.id }).unwrap();
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      log.warn("open conversation failed", { status: (err as { status?: number })?.status });
      setError((err as { data?: { message?: string } })?.data?.message ?? "Couldn't open chat.");
    }
  };

  return (
    <li
      onClick={selectable ? onToggle : undefined}
      className={`rounded-card border bg-surface p-3.5 transition-colors ${
        selectable ? "cursor-pointer active:scale-[0.99]" : ""
      } ${
        selecting && !actionable ? "opacity-45" : ""
      } ${selected ? "border-ink ring-1 ring-ink" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        {selecting ? (
          <span
            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              !actionable
                ? "border-black/10 bg-black/[0.03]"
                : selected
                  ? "border-ink bg-ink text-white"
                  : "border-black/20"
            }`}
          >
            {selected ? <Check size={13} strokeWidth={3} /> : null}
          </span>
        ) : null}
        <Avatar name={w.full_name} src={w.profile_picture} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
            <span className="truncate">{w.full_name ?? "Worker"}</span>
            {w.verification_status === "verified" ? (
              <BadgeCheck size={14} className="shrink-0 text-sky" />
            ) : null}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-text-secondary">
            <span className="inline-flex items-center gap-0.5 font-semibold text-ink">
              <Star size={12} className="text-brand-dark" /> {w.reliability_score}
            </span>
            <span>{w.attendance_rate}% attendance</span>
            <span>{w.completed_shift_count} shifts</span>
            {w.no_show_count > 0 ? <span className="text-danger">{w.no_show_count} no-show</span> : null}
          </div>
        </div>
        <ApplicantStatusTag status={applicant.status} />
      </div>

      {applicant.note ? (
        <p className="mt-2 rounded-xl bg-black/[0.03] p-2.5 text-[13px] text-text-secondary">
          “{applicant.note}”
        </p>
      ) : null}

      {error ? <p className="mt-2 text-[12px] font-medium text-danger">{error}</p> : null}

      {selecting ? null : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={message}
            disabled={opening}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold text-ink active:scale-95 disabled:opacity-50"
          >
            <MessageCircle size={15} /> Message
          </button>

          {actionable ? (
            <>
              <button
                type="button"
                onClick={() => act("reject")}
                disabled={deciding}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger active:scale-90 disabled:opacity-50"
                aria-label="Reject"
              >
                <X size={16} />
              </button>
              {pending ? (
                <button
                  type="button"
                  onClick={() => act("shortlist")}
                  disabled={deciding}
                  className="flex h-9 items-center rounded-full bg-black/[0.06] px-3 text-[13px] font-semibold text-ink active:scale-95 disabled:opacity-50"
                >
                  Shortlist
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => act("unshortlist")}
                  disabled={deciding}
                  className="flex h-9 items-center rounded-full bg-black/[0.06] px-3 text-[13px] font-semibold text-text-secondary active:scale-95 disabled:opacity-50"
                >
                  Unshortlist
                </button>
              )}
              <button
                type="button"
                onClick={() => act("accept")}
                disabled={deciding || capacityFull}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-40"
              >
                <Check size={15} /> {capacityFull ? "Full" : "Hire"}
              </button>
            </>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ApplicantStatusTag({ status }: { status: string }) {
  if (status === "pending") return null;
  const map: Record<string, string> = {
    shortlisted: "bg-sky/10 text-sky",
    accepted: "bg-emerald/10 text-emerald",
    rejected: "bg-danger/10 text-danger",
    withdrawn: "bg-black/[0.06] text-text-tertiary",
    no_show: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        map[status] ?? "bg-black/[0.06] text-text-tertiary"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Avatar({ name, src }: { name: string | null; src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? "Worker"} className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-[16px] font-bold text-ink">
      {initial}
    </span>
  );
}

/* ------------------------------ Skeletons ------------------------------- */

function Skeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col px-5 pt-5">
      <BackBar onBack={onBack} title="Loading…" />
      <div className="mt-4 h-9 animate-pulse rounded-full bg-black/[0.05]" />
      <div className="mt-4 space-y-3">
        <div className="h-28 animate-pulse rounded-card bg-black/[0.05]" />
        <div className="h-10 animate-pulse rounded-card bg-black/[0.05]" />
        <div className="h-10 animate-pulse rounded-card bg-black/[0.05]" />
      </div>
    </div>
  );
}

function ApplicantsSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-[120px] animate-pulse rounded-card bg-black/[0.05]" />
      ))}
    </ul>
  );
}
