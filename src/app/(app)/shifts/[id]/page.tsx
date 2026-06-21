"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Star,
  UtensilsCrossed,
  Users,
} from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import Button from "@/components/ui/Button";
import { useAppSelector } from "@/store/hooks";
import { useApplyToShiftMutation, useGetShiftQuery } from "@/store/api/shiftsApi";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { gsap, useGSAP } from "@/lib/gsap";
import { createLogger } from "@/lib/logger";
import type { Shift } from "@/types/shift";

const log = createLogger("shift:detail");

export default function ShiftDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: shift, isLoading, isError } = useGetShiftQuery(id);

  return (
    <div className="min-h-full px-6 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>

      {isLoading ? (
        <DetailSkeleton />
      ) : isError || !shift ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-[15px] font-semibold text-ink">Shift not found</p>
          <p className="text-[14px] text-text-secondary">It may have been filled or removed.</p>
          <Button variant="secondary" onClick={() => router.push("/explore")} className="mt-2">
            Back to explore
          </Button>
        </div>
      ) : (
        <ShiftDetail shift={shift} />
      )}
    </div>
  );
}

function ShiftDetail({ shift }: { shift: Shift }) {
  const biz = shift.business_profiles;
  const profile = useAppSelector((s) => s.auth.profile);
  const isVerified = profile?.verification_status === "verified";
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!scope.current) return;
      gsap.from(scope.current.children, {
        y: 18,
        autoAlpha: 0,
        duration: 0.45,
        ease: "power3.out",
        stagger: 0.07,
      });
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <div className="flex items-center gap-3">
        <BusinessAvatar name={biz.business_name} logo={biz.logo_url} size={48} />
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[15px] font-bold text-ink">
            <span className="truncate">{biz.business_name}</span>
            {biz.verification_status === "verified" ? (
              <BadgeCheck size={16} className="shrink-0 text-sky" />
            ) : null}
          </p>
          {biz.reliability_score !== undefined ? (
            <p className="flex items-center gap-1 text-[13px] text-text-secondary">
              <Star size={13} className="fill-warning text-warning" />
              {Number(biz.reliability_score).toFixed(0)} reliability
            </p>
          ) : null}
        </div>
      </div>

      <h1 className="mt-5 text-2xl font-bold leading-tight text-ink">{shift.title}</h1>
      <p className="mt-1 text-[28px] font-bold text-ink">
        {formatTaka(shift.pay_amount)}
        <span className="ml-1 text-[14px] font-medium text-text-tertiary">per shift</span>
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <InfoTile icon={CalendarDays} label="Date" value={formatShiftDate(shift.shift_date)} />
        <InfoTile icon={Clock} label="Time" value={formatTimeRange(shift.start_time, shift.end_time)} />
        <InfoTile
          icon={MapPin}
          label="Location"
          value={shift.zones?.name ?? shift.address ?? "—"}
        />
        <InfoTile
          icon={Users}
          label="Slots"
          value={`${shift.filled}/${shift.capacity} filled`}
        />
      </div>

      {shift.meal_included || shift.transport_support ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {shift.meal_included ? (
            <Perk icon={UtensilsCrossed} label="Meal included" />
          ) : null}
          {shift.transport_support ? <Perk icon={Bus} label="Transport support" /> : null}
        </div>
      ) : null}

      {shift.address ? (
        <p className="mt-4 flex items-start gap-1.5 text-[14px] text-text-secondary">
          <MapPin size={15} className="mt-0.5 shrink-0" />
          <span>
            {shift.address}
            {shift.landmark ? ` · ${shift.landmark}` : ""}
          </span>
        </p>
      ) : null}

      {shift.description ? (
        <section className="mt-6">
          <h2 className="mb-1.5 text-[15px] font-bold text-ink">About this shift</h2>
          <p className="whitespace-pre-line text-[14px] leading-6 text-text-secondary">
            {shift.description}
          </p>
        </section>
      ) : null}

      <div className="mt-8">
        <ApplySection shift={shift} isVerified={isVerified} nextStep={profile?.next_step} />
      </div>
    </div>
  );
}

function ApplySection({
  shift,
  isVerified,
  nextStep,
}: {
  shift: Shift;
  isVerified: boolean;
  nextStep?: string | null;
}) {
  const router = useRouter();
  const [apply, { isLoading }] = useApplyToShiftMutation();
  const [note, setNote] = useState("");
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (applied && successRef.current) {
        gsap.from(successRef.current, {
          scale: 0.8,
          autoAlpha: 0,
          duration: 0.4,
          ease: "back.out(2)",
        });
      }
    },
    { dependencies: [applied] },
  );

  if (applied) {
    return (
      <div ref={successRef} className="flex items-center gap-3 rounded-2xl bg-emerald/10 p-4 text-emerald">
        <CheckCircle2 size={22} />
        <div>
          <p className="text-[15px] font-bold">Applied!</p>
          <p className="text-[13px] text-emerald-dark">Track it in your Activity tab.</p>
        </div>
      </div>
    );
  }

  if (shift.is_full) {
    return (
      <Button fullWidth disabled>
        This shift is full
      </Button>
    );
  }

  if (!isVerified) {
    return (
      <div className="rounded-2xl bg-brand/40 p-4 text-center">
        <p className="text-[14px] font-semibold text-ink">Get verified to apply</p>
        <p className="mt-1 text-[13px] text-text-muted">
          Finish your profile and pass admin review to start applying.
        </p>
        <Button fullWidth onClick={() => router.push("/onboarding/worker")} className="mt-3">
          {nextStep ? "Finish profile" : "View profile"}
        </Button>
      </div>
    );
  }

  const onApply = async () => {
    setError(null);
    try {
      await apply({ shift_id: shift.id, note: note.trim() || undefined }).unwrap();
      setApplied(true);
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Could not apply. Try again.";
      log.warn("apply failed", { shiftId: shift.id, message });
      setError(message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Add a note for the business (optional)"
        rows={3}
        className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[14px] text-ink outline-none focus:border-sky"
      />
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      <Button fullWidth loading={isLoading} onClick={onApply}>
        Apply now
      </Button>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
        <Icon size={14} /> {label}
      </span>
      <p className="mt-1 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function Perk({ icon: Icon, label }: { icon: typeof Bus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1.5 text-[13px] font-medium text-emerald">
      <Icon size={14} /> {label}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-3">
        <span className="h-12 w-12 rounded-full bg-black/[0.06]" />
        <div className="space-y-2">
          <span className="block h-3 w-32 rounded bg-black/[0.06]" />
          <span className="block h-2.5 w-20 rounded bg-black/[0.06]" />
        </div>
      </div>
      <span className="mt-5 block h-6 w-3/4 rounded bg-black/[0.06]" />
      <span className="mt-3 block h-8 w-28 rounded bg-black/[0.06]" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-16 rounded-2xl bg-black/[0.06]" />
        ))}
      </div>
    </div>
  );
}
