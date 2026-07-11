"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Hourglass,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  UserX,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import CheckInSheet from "@/components/shifts/CheckInSheet";
import DisputeSheet from "@/components/engagement/DisputeSheet";
import RatingSheet from "@/components/engagement/RatingSheet";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import {
  useCheckOutMutation,
  useConfirmCheckoutMutation,
  useGetApplicationsQuery,
  useWithdrawApplicationMutation,
} from "@/store/api/shiftsApi";
import { useOpenConversationMutation } from "@/store/api/chatApi";
import { useGetRatingsQuery } from "@/store/api/engagementApi";
import {
  formatCountdown,
  formatInstantTime,
  formatShiftDate,
  formatTaka,
  formatTimeRange,
} from "@/lib/format";
import { googleMapsDirUrl, shiftLatLng } from "@/lib/geo";
import { gsap, useGSAP } from "@/lib/gsap";
import { deriveAttendance } from "@/lib/attendance";
import type { ApplicationStatus, CompletionStatus, Shift } from "@/types/shift";

/** Handshake states where money has moved and the shift is done for the worker. */
const PAID_STATES: CompletionStatus[] = ["confirmed", "resolved"];

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback
  );
}

type StatusUI = { label: string; chip: string; icon: typeof BadgeCheck };

const STATUS_UI: Record<ApplicationStatus, StatusUI> = {
  pending: { label: "Pending review", chip: "bg-warning/20 text-text-muted", icon: Clock },
  shortlisted: { label: "Shortlisted", chip: "bg-sky/15 text-sky", icon: Star },
  accepted: { label: "You're hired", chip: "bg-emerald/10 text-emerald", icon: BadgeCheck },
  rejected: { label: "Not selected", chip: "bg-danger/10 text-danger", icon: XCircle },
  withdrawn: { label: "Withdrawn", chip: "bg-black/5 text-text-secondary", icon: XCircle },
  no_show: { label: "No show", chip: "bg-danger/10 text-danger", icon: UserX },
};

const WITHDRAWABLE: ApplicationStatus[] = ["pending", "shortlisted"];

type StepState = "done" | "current" | "upcoming" | "failed";
type Step = { label: string; state: StepState };

/** Builds the compact status track; terminal states branch to a red end node. */
function buildSteps(
  status: ApplicationStatus,
  checkedIn: boolean,
  checkedOut: boolean,
  completion: CompletionStatus | null,
): Step[] {
  const applied: Step = { label: "Applied", state: "done" };
  if (status === "withdrawn") return [applied, { label: "Withdrawn", state: "failed" }];
  if (status === "rejected")
    return [applied, { label: "Reviewed", state: "done" }, { label: "Not selected", state: "failed" }];
  if (status === "no_show")
    return [
      applied,
      { label: "Reviewed", state: "done" },
      { label: "Hired", state: "done" },
      { label: "No show", state: "failed" },
    ];

  const reviewed: StepState = status === "pending" ? "current" : "done";
  const hired: StepState =
    status === "accepted" ? "done" : status === "shortlisted" ? "current" : "upcoming";
  let onShift: StepState = "upcoming";
  let completed: StepState = "upcoming";
  if (status === "accepted") {
    const paid = completion ? PAID_STATES.includes(completion) : false;
    if (paid) {
      onShift = "done";
      completed = "done";
    } else if (checkedOut) {
      // Checked out but the handshake (business confirm / auto-confirm) is still
      // open — the "Done" node is in progress, not finished.
      onShift = "done";
      completed = "current";
    } else if (checkedIn) {
      onShift = "done";
      completed = "current";
    } else {
      onShift = "current";
    }
  }
  return [
    applied,
    { label: "Reviewed", state: reviewed },
    { label: "Hired", state: hired },
    { label: "On shift", state: onShift },
    { label: "Done", state: completed },
  ];
}

type SheetKey = "schedule" | "payout" | "trust" | "about";

/**
 * Compact, single-screen application view (no page scroll). Essentials stay
 * pinned — hero, a horizontal status timeline, the contextual action — while the
 * detail-heavy sections live behind tappable tiles that open animated drawers.
 * Reached from the Activity tab; the discovery/apply view handles un-applied shifts.
 */
export default function ApplicationDetail({ shift }: { shift: Shift }) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const biz = shift.business_profiles;
  const appId = shift.my_application?.id ?? "";

  const [status, setStatus] = useState<ApplicationStatus>(shift.my_application?.status ?? "pending");

  // Attendance can't come from the shift payload — `my_application` is only
  // `{ id, status }` there. Pull the enriched application row (which spreads the
  // raw application, incl. the attendance stamps) from the tracker so a worker
  // who already checked in doesn't see "Check in" again after remounting. Only
  // needed once hired.
  const { data: apps } = useGetApplicationsQuery(
    { status: "accepted", page: 1, limit: 50 },
    { skip: status !== "accepted" },
  );
  const record = apps?.items.find((a) => a.shifts.id === shift.id);

  // Local overrides hold optimistic post-action updates; otherwise fall back to
  // the server-known state so the buttons are correct on first paint. The
  // enriched tracker row also carries the handshake (`completion_status`,
  // `next_action`, `assignment_id`, `auto_confirm_at`).
  const [localCheckedInAt, setLocalCheckedInAt] = useState<string | null>(null);
  const [localCheckedOutAt, setLocalCheckedOutAt] = useState<string | null>(null);
  const [localCompletion, setLocalCompletion] = useState<CompletionStatus | null>(null);

  // Timestamps drive only the display line; the button logic runs off booleans
  // derived from the enriched fields (raw stamps aren't reliably serialized).
  const checkedInAt = localCheckedInAt ?? record?.checked_in_at ?? null;
  const checkedOutAt = localCheckedOutAt ?? record?.checked_out_at ?? null;
  const derived = deriveAttendance(record);
  const isCheckedIn = localCheckedInAt !== null || derived.checkedIn;
  const isCheckedOut = localCheckedOutAt !== null || derived.checkedOut;
  const completion = localCompletion ?? record?.completion_status ?? null;
  const assignmentId = record?.assignment_id ?? null;
  const autoConfirmAt = record?.auto_confirm_at ?? null;

  // Whether this worker has already rated the business for this shift — a rating
  // is one-per-direction-per-shift, so hide the "Rate" action once it's given.
  const isPaid = completion ? PAID_STATES.includes(completion) : false;
  const { data: givenRatings } = useGetRatingsQuery({ direction: "given" }, { skip: !isPaid });
  const alreadyRated = Boolean(
    givenRatings?.items.some(
      (r) => (assignmentId && r.assignment_id === assignmentId) || r.shifts?.id === shift.id,
    ),
  );

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const [withdraw, { isLoading: withdrawing }] = useWithdrawApplicationMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();
  const [confirmCheckout, { isLoading: confirming }] = useConfirmCheckoutMutation();
  const [openConversation, { isLoading: openingChat }] = useOpenConversationMutation();

  const sui = STATUS_UI[status];
  const StatusIcon = sui.icon;
  const remaining = Math.max(shift.capacity - shift.filled, 0);
  const fillPct = shift.capacity > 0 ? Math.round((shift.filled / shift.capacity) * 100) : 0;
  const reliability = Math.max(0, Math.min(100, Math.round(Number(biz.reliability_score ?? 0))));
  const steps = buildSteps(status, isCheckedIn, isCheckedOut, completion);
  const isAccepted = status === "accepted";
  const canWithdraw = WITHDRAWABLE.includes(status);
  const gmapsUrl = googleMapsDirUrl(shiftLatLng(shift));

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  useGSAP(
    () => {
      if (!scope.current) return;
      gsap.from(scope.current.querySelectorAll("[data-rise]"), {
        y: 16,
        autoAlpha: 0,
        duration: 0.45,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope },
  );

  const doWithdraw = async () => {
    try {
      await withdraw(appId).unwrap();
      setStatus("withdrawn");
    } catch {
      /* keep current status on failure */
    } finally {
      setConfirmWithdraw(false);
    }
  };

  const doCheckOut = async () => {
    setActionError(null);
    try {
      const res = await checkOut(appId).unwrap();
      setLocalCheckedOutAt(res.checked_out_at);
      setLocalCompletion(res.completion_status ?? "worker_done");
    } catch (err) {
      setActionError(errMessage(err, "Check-out failed. Try again."));
    }
  };

  const doConfirmCheckout = async () => {
    setActionError(null);
    try {
      const res = await confirmCheckout(appId).unwrap();
      setLocalCompletion(res.completion_status ?? "confirmed");
      showToast("Check-out confirmed — payment released.");
    } catch (err) {
      setActionError(errMessage(err, "Couldn't confirm. Try again."));
    }
  };

  const openChat = async () => {
    setChatError(null);
    try {
      const convo = await openConversation({ shift_id: shift.id }).unwrap();
      router.push(`/chat/${convo.id}`);
    } catch (err) {
      setChatError(errMessage(err, "Couldn't open chat. Try again."));
    }
  };

  return (
    <div ref={scope} className="flex h-full min-h-0 flex-col">
      {/* Business + status — one compact row */}
      <div data-rise className="flex items-center gap-3">
        <BusinessAvatar name={biz.business_name} logo={biz.logo_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14px] font-bold text-ink">
            <span className="truncate">{biz.business_name}</span>
            {biz.verification_status === "verified" ? (
              <BadgeCheck size={15} className="shrink-0 text-sky" />
            ) : null}
          </p>
          <p className="flex items-center gap-1 text-[12px] text-text-secondary">
            <Star size={12} className="fill-warning text-warning" />
            {reliability} reliability
          </p>
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${sui.chip}`}>
          <StatusIcon size={12} /> {sui.label}
        </span>
      </div>

      {/* Title + pay */}
      <div data-rise className="mt-3">
        <h1 className="text-xl font-extrabold leading-tight text-ink">{shift.title}</h1>
        <p className="mt-0.5 text-[22px] font-extrabold text-ink">
          {formatTaka(shift.pay_amount)}
          <span className="ml-1 text-[13px] font-medium text-text-tertiary">/ shift</span>
        </p>
      </div>

      {/* Horizontal status timeline */}
      <div data-rise className="mt-4 rounded-2xl border border-border bg-surface/70 px-3 py-3.5">
        <HorizontalTimeline steps={steps} />
        {(checkedInAt || checkedOutAt) && (
          <p className="mt-2.5 text-center text-[11px] text-text-secondary">
            {checkedOutAt
              ? `Checked out ${formatInstantTime(checkedOutAt)}`
              : `Checked in ${formatInstantTime(checkedInAt as string)}`}
          </p>
        )}
      </div>

      {/* Contextual primary action */}
      <div data-rise className="mt-3">
        <PrimaryAction
          status={status}
          isAccepted={isAccepted}
          canWithdraw={canWithdraw}
          checkedIn={isCheckedIn}
          checkedOut={isCheckedOut}
          completion={completion}
          autoConfirmAt={autoConfirmAt}
          canDispute={Boolean(assignmentId)}
          alreadyRated={alreadyRated}
          checkingOut={checkingOut}
          confirming={confirming}
          onCheckIn={() => {
            setActionError(null);
            setCheckInOpen(true);
          }}
          onCheckOut={doCheckOut}
          onConfirmCheckout={doConfirmCheckout}
          onWithdraw={() => setConfirmWithdraw(true)}
          onDispute={() => {
            setActionError(null);
            setDisputeOpen(true);
          }}
          onRate={() => setRateOpen(true)}
        />
        {actionError ? <p className="mt-1.5 text-[12px] font-medium text-danger">{actionError}</p> : null}
      </div>

      {/* Detail tiles — open drawers (keeps the screen non-scrolling) */}
      <div data-rise className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile
          icon={CalendarDays}
          label="Schedule"
          value={formatShiftDate(shift.shift_date)}
          onClick={() => setSheet("schedule")}
        />
        <Tile
          icon={Wallet}
          label="Payout"
          value={formatTaka(shift.pay_amount)}
          onClick={() => setSheet("payout")}
        />
        <Tile
          icon={ShieldCheck}
          label="Trust"
          value={`${reliability}/100`}
          onClick={() => setSheet("trust")}
        />
        <Tile
          icon={FileText}
          label="Details"
          value={shift.description ? "Read more" : `${shift.filled}/${shift.capacity} hired`}
          onClick={() => setSheet("about")}
        />
      </div>

      {/* Chat with the business — per-shift thread */}
      <button
        data-rise
        type="button"
        onClick={openChat}
        disabled={openingChat}
        className="mt-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-ink">
            <MessageCircle size={15} />
          </span>
          <span className="text-left">
            <span className="block text-[14px] font-semibold text-ink">Chat with business</span>
            <span className={`block text-[12px] ${chatError ? "text-danger" : "text-text-tertiary"}`}>
              {chatError ?? `Ask ${biz.business_name} a question`}
            </span>
          </span>
        </span>
        {openingChat ? (
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        ) : (
          <ChevronRight size={16} className="text-text-tertiary" />
        )}
      </button>

      {/* ---------- drawers ---------- */}
      <BottomSheet open={sheet === "schedule"} onClose={() => setSheet(null)}>
        <DrawerHeader icon={CalendarDays} title="Schedule & location" />
        <div className="grid grid-cols-2 gap-2.5">
          <InfoTile icon={CalendarDays} label="Date" value={formatShiftDate(shift.shift_date)} />
          <InfoTile icon={Clock} label="Time" value={formatTimeRange(shift.start_time, shift.end_time)} />
          <InfoTile icon={MapPin} label="Area" value={shift.zones?.name ?? shift.address ?? "—"} />
          <InfoTile icon={Users} label="Slots" value={`${shift.filled}/${shift.capacity} hired`} />
        </div>
        {shift.address ? (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-text-secondary">
            <MapPin size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
            <span>
              {shift.address}
              {shift.landmark ? ` · ${shift.landmark}` : ""}
            </span>
          </p>
        ) : null}
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[15px] font-bold text-white active:scale-[0.99]"
        >
          <Navigation size={17} /> Get directions
        </a>
      </BottomSheet>

      <BottomSheet open={sheet === "payout"} onClose={() => setSheet(null)}>
        <DrawerHeader icon={Wallet} title="Payout" />
        <div className="flex items-end justify-between">
          <p className="text-[30px] font-black leading-none text-ink">{formatTaka(shift.pay_amount)}</p>
          <span className="rounded-full bg-brand/20 px-3 py-1.5 text-[12px] font-bold text-ink">Flat pay</span>
        </div>
        <p className="mt-2.5 text-[13px] leading-5 text-text-secondary">
          {payoutNote(status, isCheckedIn, isCheckedOut, completion)}
        </p>
        <button
          type="button"
          onClick={() => router.push("/wallet")}
          className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold text-ink active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <Wallet size={17} className="text-text-tertiary" /> View wallet
          </span>
          <ChevronRight size={17} className="text-text-tertiary" />
        </button>
      </BottomSheet>

      <BottomSheet open={sheet === "trust"} onClose={() => setSheet(null)}>
        <DrawerHeader icon={ShieldCheck} title="Trust & safety" />
        <Metric label="Business reliability" value={`${reliability}/100`}>
          <Meter pct={reliability} />
        </Metric>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            biz.verification_status === "verified" ? "bg-sky/10 text-sky" : "bg-black/5 text-text-tertiary"
          }`}
        >
          {biz.verification_status === "verified" ? <BadgeCheck size={14} /> : <ShieldCheck size={14} />}
          {biz.verification_status === "verified" ? "Verified business" : "Not yet verified"}
        </span>
        <Metric className="mt-4" label="Hiring progress" value={`${shift.filled}/${shift.capacity} hired`}>
          <Meter pct={fillPct} tone="emerald" />
        </Metric>
        <p className="mt-1.5 text-[12px] text-text-tertiary">
          {shift.is_full
            ? "All slots filled."
            : `${remaining} spot${remaining === 1 ? "" : "s"} left — hiring is competitive.`}
        </p>
      </BottomSheet>

      <BottomSheet open={sheet === "about"} onClose={() => setSheet(null)}>
        <DrawerHeader icon={FileText} title="About this shift" />
        {shift.description ? (
          <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-[14px] leading-6 text-text-secondary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shift.description}
          </p>
        ) : (
          <p className="text-[14px] text-text-secondary">No extra details provided for this shift.</p>
        )}
      </BottomSheet>

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
        applicationId={appId}
        onCheckedIn={(at) => setLocalCheckedInAt(at)}
      />

      {assignmentId ? (
        <DisputeSheet
          open={disputeOpen}
          assignmentId={assignmentId}
          title={shift.title}
          hint={
            status === "no_show"
              ? "Marked absent but you were there? Tell us what happened."
              : "Disagree with the check-out or pay? Tell us what happened."
          }
          onClose={() => setDisputeOpen(false)}
          onDone={(msg) => {
            setDisputeOpen(false);
            setLocalCompletion("disputed");
            showToast(msg);
          }}
        />
      ) : null}

      {assignmentId ? (
        <RatingSheet
          open={rateOpen}
          assignmentId={assignmentId}
          ratee={biz.business_name}
          onClose={() => setRateOpen(false)}
          onDone={(msg) => {
            setRateOpen(false);
            showToast(msg);
          }}
        />
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

/** Money status line under the payout figure. */
function payoutNote(
  status: ApplicationStatus,
  checkedIn: boolean,
  checkedOut: boolean,
  completion: CompletionStatus | null,
): string {
  if (status === "no_show") return "No payout — marked absent.";
  if (status !== "accepted") {
    if (status === "pending" || status === "shortlisted") return "You'll earn this if you're hired.";
    return "No payout for this shift.";
  }
  if (completion && PAID_STATES.includes(completion)) return "Paid — it's in your wallet.";
  if (completion === "disputed") return "Frozen while an admin reviews your dispute.";
  if (completion === "business_done") return "The business logged your check-out — confirm to get paid now.";
  if (checkedOut || completion === "worker_done")
    return "Waiting for the business to confirm — it auto-confirms and pays out on the deadline.";
  if (checkedIn) return "On shift — check out to lock your pay.";
  return "Check in at the venue to start earning.";
}

/**
 * Contextual action + handshake status for the applied shift. Once the worker
 * has checked out, there are no more attendance buttons — the block shows the
 * completion state (awaiting confirm / confirm-needed / paid / disputed) and, at
 * the end, the "rate the business" prompt.
 */
function PrimaryAction({
  status,
  isAccepted,
  canWithdraw,
  checkedIn,
  checkedOut,
  completion,
  autoConfirmAt,
  canDispute,
  alreadyRated,
  checkingOut,
  confirming,
  onCheckIn,
  onCheckOut,
  onConfirmCheckout,
  onWithdraw,
  onDispute,
  onRate,
}: {
  status: ApplicationStatus;
  isAccepted: boolean;
  canWithdraw: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  completion: CompletionStatus | null;
  autoConfirmAt: string | null;
  canDispute: boolean;
  alreadyRated: boolean;
  checkingOut: boolean;
  confirming: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onConfirmCheckout: () => void;
  onWithdraw: () => void;
  onDispute: () => void;
  onRate: () => void;
}) {
  // No-show — offer a dispute if the worker believes it's wrong.
  if (status === "no_show") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-danger/10 py-3.5 text-[15px] font-bold text-danger">
          <UserX size={18} /> Marked no-show
        </div>
        {canDispute ? <DisputeLink onDispute={onDispute} label="I was there — dispute this" /> : null}
      </div>
    );
  }

  if (isAccepted) {
    const paid = completion ? PAID_STATES.includes(completion) : false;

    // Handshake done — money moved. Show a paid banner + the rating prompt (or a
    // "rated" acknowledgement once the worker has already rated the business).
    if (paid) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald/10 py-3.5 text-[15px] font-bold text-emerald">
            <CheckCircle2 size={18} /> Shift completed · paid
          </div>
          {alreadyRated ? (
            <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-border py-3 text-[14px] font-semibold text-text-secondary">
              <Star size={15} className="fill-brand text-brand" /> You rated the business
            </div>
          ) : (
            <Button fullWidth variant="secondary" onClick={onRate}>
              <Star size={16} /> Rate the business
            </Button>
          )}
        </div>
      );
    }

    // Frozen by a dispute.
    if (completion === "disputed") {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-warning/15 py-3.5 text-[15px] font-bold text-text-muted">
          <ShieldAlert size={18} /> Under review
        </div>
      );
    }

    // Business stamped the check-out — worker confirms (paid now) or disputes.
    if (completion === "business_done") {
      return (
        <div className="space-y-2">
          <Button fullWidth loading={confirming} onClick={onConfirmCheckout}>
            <UserCheck size={17} /> Confirm check-out & get paid
          </Button>
          {canDispute ? <DisputeLink onDispute={onDispute} label="This isn't right — dispute" /> : null}
        </div>
      );
    }

    // Checked out — waiting on the business (auto-confirms on the deadline).
    if (checkedOut) {
      const countdown = formatCountdown(autoConfirmAt);
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-sky/10 py-3.5 text-[14px] font-bold text-sky">
            <Hourglass size={17} /> Awaiting confirmation
            {countdown ? <span className="font-semibold text-sky/80">· auto-confirms {countdown}</span> : null}
          </div>
          {canDispute ? <DisputeLink onDispute={onDispute} label="Something wrong? Raise a dispute" /> : null}
        </div>
      );
    }

    // Checked in — the only remaining attendance action is check-out.
    if (checkedIn) {
      return (
        <Button fullWidth loading={checkingOut} onClick={onCheckOut} className="bg-ink text-white">
          <LogOut size={17} /> Check out
        </Button>
      );
    }

    // Hired, not yet on site.
    return (
      <Button fullWidth onClick={onCheckIn}>
        <LogIn size={17} /> Check in
      </Button>
    );
  }

  if (canWithdraw) {
    return (
      <Button fullWidth variant="secondary" onClick={onWithdraw} className="border-danger/30 text-danger">
        <X size={16} /> Withdraw application
      </Button>
    );
  }
  return null;
}

/** Subtle text link that opens the dispute sheet. */
function DisputeLink({ onDispute, label }: { onDispute: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onDispute}
      className="flex w-full items-center justify-center gap-1.5 py-1 text-[12px] font-semibold text-text-tertiary active:scale-95"
    >
      <ShieldAlert size={13} /> {label}
    </button>
  );
}

/* ---------------------------- horizontal timeline ---------------------------- */

function HorizontalTimeline({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      gsap.from(root.querySelectorAll(".tl-seg"), {
        scaleX: 0,
        transformOrigin: "left",
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.07,
      });
      gsap.from(root.querySelectorAll(".tl-dot"), {
        scale: 0,
        autoAlpha: 0,
        duration: 0.4,
        ease: "back.out(2.2)",
        stagger: 0.07,
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="flex items-start">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={s.label} className="relative flex flex-1 flex-col items-center">
            {!last ? (
              <span
                aria-hidden
                className={`tl-seg absolute left-1/2 top-[13px] h-0.5 w-full rounded-full ${
                  s.state === "done" ? "bg-emerald" : "bg-black/10"
                }`}
              />
            ) : null}
            <Dot state={s.state} />
            <p
              className={`mt-1.5 text-center text-[10px] font-semibold leading-tight ${
                s.state === "upcoming"
                  ? "text-text-tertiary"
                  : s.state === "failed"
                    ? "text-danger"
                    : "text-ink"
              }`}
            >
              {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Dot({ state }: { state: StepState }) {
  const base = "tl-dot relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full";
  if (state === "done")
    return (
      <span className={`${base} bg-emerald text-white`}>
        <Check size={15} strokeWidth={3} />
      </span>
    );
  if (state === "failed")
    return (
      <span className={`${base} bg-danger text-white`}>
        <X size={15} strokeWidth={3} />
      </span>
    );
  if (state === "current")
    return (
      <span className={`${base} bg-brand text-ink ring-4 ring-brand/25`}>
        <span className="h-2.5 w-2.5 rounded-full bg-ink" />
      </span>
    );
  return (
    <span className={`${base} border-2 border-black/10 bg-surface`}>
      <span className="h-2 w-2 rounded-full bg-black/15" />
    </span>
  );
}

/* ---------------------------- primitives ---------------------------- */

function Tile({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.98]"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
          <Icon size={14} /> {label}
        </span>
        <span className="mt-0.5 block truncate text-[14px] font-bold text-ink">{value}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
    </button>
  );
}

function DrawerHeader({ icon: Icon, title }: { icon: typeof CalendarDays; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-ink">
        <Icon size={18} />
      </span>
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[0.03] p-3">
      <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
        <Icon size={14} /> {label}
      </span>
      <p className="mt-1 truncate text-[14px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "",
  children,
}: {
  label: string;
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="font-semibold text-text-secondary">{label}</span>
        <span className="font-bold text-ink">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Meter({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "emerald" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      gsap.from(ref.current, { width: 0, duration: 0.7, ease: "power3.out" });
    },
    { dependencies: [pct] },
  );
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <span
        ref={ref}
        className={`block h-full rounded-full ${tone === "emerald" ? "bg-emerald" : "bg-brand"}`}
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
    </div>
  );
}
