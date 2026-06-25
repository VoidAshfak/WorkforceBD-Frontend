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
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  ShieldCheck,
  Star,
  UserX,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import CheckInSheet from "@/components/shifts/CheckInSheet";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useCheckOutMutation, useWithdrawApplicationMutation } from "@/store/api/shiftsApi";
import { formatInstantTime, formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { googleMapsDirUrl, shiftLatLng } from "@/lib/geo";
import { gsap, useGSAP } from "@/lib/gsap";
import type { ApplicationStatus, Shift } from "@/types/shift";

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
  checkedInAt: string | null,
  checkedOutAt: string | null,
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
    if (checkedOutAt) {
      onShift = "done";
      completed = "done";
    } else if (checkedInAt) {
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
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const [withdraw, { isLoading: withdrawing }] = useWithdrawApplicationMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const sui = STATUS_UI[status];
  const StatusIcon = sui.icon;
  const remaining = Math.max(shift.capacity - shift.filled, 0);
  const fillPct = shift.capacity > 0 ? Math.round((shift.filled / shift.capacity) * 100) : 0;
  const reliability = Math.max(0, Math.min(100, Math.round(Number(biz.reliability_score ?? 0))));
  const steps = buildSteps(status, checkedInAt, checkedOutAt);
  const isAccepted = status === "accepted";
  const canWithdraw = WITHDRAWABLE.includes(status);
  const gmapsUrl = googleMapsDirUrl(shiftLatLng(shift));

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
      setCheckedOutAt(res.checked_out_at);
    } catch (err) {
      setActionError(errMessage(err, "Check-out failed. Try again."));
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
          isAccepted={isAccepted}
          canWithdraw={canWithdraw}
          checkedInAt={checkedInAt}
          checkedOutAt={checkedOutAt}
          checkingOut={checkingOut}
          onCheckIn={() => {
            setActionError(null);
            setCheckInOpen(true);
          }}
          onCheckOut={doCheckOut}
          onWithdraw={() => setConfirmWithdraw(true)}
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

      {/* Chat — stub (no messaging API yet) */}
      <button
        data-rise
        type="button"
        disabled
        className="mt-2.5 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 opacity-70"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-ink">
            <MessageCircle size={15} />
          </span>
          <span className="text-[14px] font-semibold text-ink">Chat with business</span>
        </span>
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-bold text-text-secondary">Soon</span>
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
          {payoutNote(status, checkedInAt, checkedOutAt)}
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
        onCheckedIn={(at) => setCheckedInAt(at)}
      />
    </div>
  );
}

/** Money status line under the payout figure. */
function payoutNote(status: ApplicationStatus, checkedIn: string | null, checkedOut: string | null): string {
  switch (status) {
    case "pending":
    case "shortlisted":
      return "You'll earn this if you're hired.";
    case "accepted":
      if (checkedOut) return "Settles after the business confirms — lands in your wallet.";
      if (checkedIn) return "On shift — check out to lock your pay.";
      return "Check in at the venue to start earning.";
    case "no_show":
      return "No payout — marked absent.";
    default:
      return "No payout for this shift.";
  }
}

function PrimaryAction({
  isAccepted,
  canWithdraw,
  checkedInAt,
  checkedOutAt,
  checkingOut,
  onCheckIn,
  onCheckOut,
  onWithdraw,
}: {
  isAccepted: boolean;
  canWithdraw: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkingOut: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onWithdraw: () => void;
}) {
  if (isAccepted) {
    if (checkedOutAt) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald/10 py-3.5 text-[15px] font-bold text-emerald">
          <CheckCircle2 size={18} /> Shift completed
        </div>
      );
    }
    if (checkedInAt) {
      return (
        <Button fullWidth loading={checkingOut} onClick={onCheckOut} className="bg-ink text-white">
          <LogOut size={17} /> Check out
        </Button>
      );
    }
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
