"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hourglass,
  Loader2,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Star,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";

import Button from "@/components/ui/Button";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import DisputeSheet from "@/components/engagement/DisputeSheet";
import RatingSheet from "@/components/engagement/RatingSheet";
import {
  useActOnAssignmentMutation,
  useGetShiftRosterQuery,
  useSettleShiftMutation,
} from "@/store/api/businessApi";
import { useGetRatingsQuery } from "@/store/api/engagementApi";
import { formatCountdown, formatInstantTime, formatTaka } from "@/lib/format";
import type {
  AssignmentAction,
  RosterEntry,
  RosterWorkerStatus,
} from "@/types/business";

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

type StatusUI = { label: string; tone: string; icon: typeof CheckCircle2 };

/** Per-worker roster status → badge treatment. */
const STATUS_UI: Record<RosterWorkerStatus, StatusUI> = {
  waiting: { label: "Waiting", tone: "bg-black/[0.05] text-text-tertiary", icon: Clock },
  checked_in: { label: "On shift", tone: "bg-emerald/10 text-emerald", icon: BadgeCheck },
  checked_out: { label: "Checked out", tone: "bg-sky/10 text-sky", icon: LogOut },
  awaiting_business_confirm: { label: "Confirm to pay", tone: "bg-brand/20 text-ink", icon: Hourglass },
  awaiting_worker_confirm: { label: "Worker to confirm", tone: "bg-sky/10 text-sky", icon: Hourglass },
  paid: { label: "Paid", tone: "bg-emerald/10 text-emerald", icon: CheckCircle2 },
  no_show: { label: "No show", tone: "bg-danger/10 text-danger", icon: UserX },
  disputed: { label: "Disputed", tone: "bg-warning/15 text-text-muted", icon: ShieldAlert },
};

/** Shift statuses where the confirm-everything settle shortcut is available. */
const SETTLEABLE = new Set(["completed", "payment_pending"]);

/**
 * Live-attendance roster for an owned shift. Shows the rotating on-site check-in
 * QR (re-fetched before it expires), every hired worker with their handshake
 * state, and the per-row completion actions (confirm & pay / stamp check-out /
 * mark no-show), plus a confirm-everything settle shortcut once the shift ends.
 */
export default function RosterTab({ shiftId }: { shiftId: string }) {
  const [showQr, setShowQr] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Poll while the QR is shown so the rotating code stays scannable; otherwise
  // just refetch on mount/focus (handshake mutations invalidate the tag).
  const { data, isLoading, isError, refetch } = useGetShiftRosterQuery(shiftId, {
    pollingInterval: showQr ? 15_000 : 0,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  // Assignments this business has already rated — used to hide the per-row "Rate"
  // action once given (one rating per direction per assignment).
  const { data: givenRatings } = useGetRatingsQuery({ direction: "given" });
  const ratedAssignments = new Set(
    (givenRatings?.items ?? []).map((r) => r.assignment_id).filter(Boolean) as string[],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  if (isLoading) return <RosterSkeleton />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/15">
          <RefreshCw size={18} className="text-text-muted" />
        </span>
        <p className="text-[14px] text-text-secondary">Couldn&apos;t load the roster.</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const { summary, roster, checkin_code, shift } = data;
  const settleable = SETTLEABLE.has(shift.status);
  const openHandshakes = roster.some(
    (r) => r.completion_status !== "confirmed" && r.completion_status !== "resolved" && r.status !== "no_show",
  );

  if (roster.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <Users size={22} className="text-ink" />
        </span>
        <p className="max-w-xs text-[13px] text-text-secondary">
          No one is hired yet. Accept applicants and they&apos;ll appear here to check in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex gap-2">
        <SummaryChip icon={Users} label="Hired" value={`${summary.assigned}/${summary.needed}`} />
        <SummaryChip icon={BadgeCheck} label="Checked in" value={String(summary.checked_in)} />
      </div>

      {/* On-site check-in QR */}
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white">
            <QrCode size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">On-site check-in code</span>
            <span className="block text-[12px] text-text-tertiary">
              Show workers this QR to check in
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-text-tertiary transition-transform ${showQr ? "rotate-180" : ""}`}
          />
        </button>
        {showQr ? (
          <div className="flex flex-col items-center gap-3 border-t border-border px-4 py-5">
            <div className="rounded-2xl bg-white p-4">
              <QRCode value={checkin_code} size={168} bgColor="#ffffff" fgColor="#141414" />
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
              <RefreshCw size={12} /> Rotates automatically — keep this open on site
            </p>
          </div>
        ) : null}
      </div>

      {/* Roster */}
      <ul className="space-y-2.5">
        {roster.map((entry) => (
          <RosterRow
            key={entry.assignment_id}
            entry={entry}
            shiftId={shiftId}
            rated={ratedAssignments.has(entry.assignment_id)}
            onToast={showToast}
          />
        ))}
      </ul>

      {/* Confirm-everything settle */}
      {settleable && openHandshakes ? (
        <SettleAll shiftId={shiftId} onToast={showToast} />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-5">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
            <CheckCircle2 size={15} className="text-emerald" /> {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RosterRow({
  entry,
  shiftId,
  rated,
  onToast,
}: {
  entry: RosterEntry;
  shiftId: string;
  /** True once this business has rated the worker for this assignment. */
  rated: boolean;
  onToast: (msg: string) => void;
}) {
  const [act, { isLoading }] = useActOnAssignmentMutation();
  const [confirm, setConfirm] = useState<null | "confirm" | "no-show">(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ui = STATUS_UI[entry.status];
  const w = entry.worker;
  const na = entry.next_action;
  const paid = entry.completion_status === "confirmed" || entry.completion_status === "resolved";
  // Business can dispute a worker's check-out before confirming it.
  const canDispute = entry.completion_status === "worker_done";

  const run = async (action: AssignmentAction, okMsg: string) => {
    setError(null);
    try {
      await act({ assignmentId: entry.assignment_id, action, shiftId }).unwrap();
      setConfirm(null);
      onToast(okMsg);
    } catch (err) {
      setConfirm(null);
      setError(errMessage(err, "Action failed. Try again."));
    }
  };

  return (
    <li className="rounded-card border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <Avatar name={w.full_name} src={w.profile_picture} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink">{w.full_name ?? "Worker"}</p>
          <p className="mt-0.5 flex items-center gap-2.5 text-[12px] text-text-secondary">
            <span className="inline-flex items-center gap-0.5 font-semibold text-ink">
              <Star size={12} className="text-brand-dark" /> {w.reliability_score}
            </span>
            {entry.checked_in_at ? <span>In {formatInstantTime(entry.checked_in_at)}</span> : null}
            {entry.checked_out_at ? <span>Out {formatInstantTime(entry.checked_out_at)}</span> : null}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${ui.tone}`}>
          <ui.icon size={12} /> {ui.label}
        </span>
      </div>

      {/* Awaiting-confirm hint with the auto-confirm deadline. */}
      {entry.status === "awaiting_business_confirm" && entry.auto_confirm_at ? (
        <p className="mt-2 text-[11px] text-text-tertiary">
          Auto-confirms &amp; pays {formatCountdown(entry.auto_confirm_at) || "soon"} if you do nothing.
        </p>
      ) : null}
      {paid && entry.paid_amount ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald">
          Paid {formatTaka(entry.paid_amount)}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-[12px] font-medium text-danger">{error}</p> : null}

      {/* Actions */}
      {na || canDispute || paid ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {paid && rated ? (
            <span className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-text-tertiary">
              <Star size={14} className="fill-brand text-brand" /> Rated
            </span>
          ) : null}
          {na === "confirm_checkout" ? (
            <button
              type="button"
              onClick={() => setConfirm("confirm")}
              disabled={isLoading}
              className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-50"
            >
              <UserCheck size={15} /> Confirm &amp; pay
            </button>
          ) : null}
          {na === "checkout" ? (
            <button
              type="button"
              onClick={() => run("checkout", "Check-out stamped — worker to confirm.")}
              disabled={isLoading}
              className="flex h-9 items-center gap-1.5 rounded-full bg-black/[0.06] px-4 text-[13px] font-semibold text-ink active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={15} />} Check out
            </button>
          ) : null}
          {na === "mark_no_show" ? (
            <button
              type="button"
              onClick={() => setConfirm("no-show")}
              disabled={isLoading}
              className="flex h-9 items-center gap-1.5 rounded-full bg-danger/10 px-4 text-[13px] font-semibold text-danger active:scale-95 disabled:opacity-50"
            >
              <UserX size={15} /> No-show
            </button>
          ) : null}
          {canDispute ? (
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-text-tertiary active:scale-95"
            >
              <ShieldAlert size={14} /> Dispute
            </button>
          ) : null}
          {paid && !rated ? (
            <button
              type="button"
              onClick={() => setRateOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink active:scale-95"
            >
              <Star size={15} /> Rate
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmSheet
        open={confirm === "confirm"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("confirm", "Worker paid — escrow released.")}
        title={`Pay ${w.full_name ?? "this worker"}?`}
        description="Confirms the check-out and releases their pay from escrow immediately. This can't be undone."
        confirmLabel="Confirm & pay"
        loading={isLoading}
        icon={Wallet}
      />

      <ConfirmSheet
        open={confirm === "no-show"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("no-show", "Marked as no-show — escrow returned.")}
        title={`Mark ${w.full_name ?? "this worker"} absent?`}
        description="Returns this slot's escrow to your wallet. The worker is notified and can dispute it."
        confirmLabel="Mark no-show"
        tone="danger"
        loading={isLoading}
        icon={UserX}
      />

      <DisputeSheet
        open={disputeOpen}
        assignmentId={entry.assignment_id}
        hint="Worker left early or didn't do the work? Tell us what happened."
        onClose={() => setDisputeOpen(false)}
        onDone={(msg) => {
          setDisputeOpen(false);
          onToast(msg);
        }}
      />

      <RatingSheet
        open={rateOpen}
        assignmentId={entry.assignment_id}
        ratee={w.full_name}
        onClose={() => setRateOpen(false)}
        onDone={(msg) => {
          setRateOpen(false);
          onToast(msg);
        }}
      />
    </li>
  );
}

function SettleAll({ shiftId, onToast }: { shiftId: string; onToast: (msg: string) => void }) {
  const [settle, { isLoading }] = useSettleShiftMutation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      const res = await settle(shiftId).unwrap();
      setOpen(false);
      const held = res.disputes_held > 0 ? ` · ${res.disputes_held} left for admin` : "";
      onToast(`${res.workers_paid} paid${res.no_show > 0 ? ` · ${res.no_show} no-show` : ""}${held}`);
    } catch (err) {
      setOpen(false);
      setError(errMessage(err, "Couldn't settle. Try again."));
    }
  };

  return (
    <div className="pt-1">
      <Button fullWidth onClick={() => setOpen(true)} loading={isLoading}>
        <Wallet size={17} /> Confirm &amp; pay everyone
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-text-tertiary">
        Pays every checked-in worker still awaiting confirmation. Disputes stay frozen for admin.
      </p>
      {error ? <p className="mt-1.5 text-center text-[12px] font-medium text-danger">{error}</p> : null}

      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={run}
        title="Pay everyone now?"
        description="Confirms all open check-outs and releases pay from escrow. Absent workers are marked no-show; any disputes stay frozen for an admin."
        confirmLabel="Confirm & pay all"
        loading={isLoading}
        icon={Wallet}
      />
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-ink">
        <Icon size={15} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-text-tertiary">{label}</span>
        <span className="block text-[15px] font-bold text-ink">{value}</span>
      </span>
    </div>
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

function RosterSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="h-14 flex-1 animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-14 flex-1 animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
      <div className="h-14 animate-pulse rounded-card bg-black/[0.05]" />
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-card bg-black/[0.05]" />
        ))}
      </div>
    </div>
  );
}
