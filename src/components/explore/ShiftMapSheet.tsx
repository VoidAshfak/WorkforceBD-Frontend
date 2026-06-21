"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Clock, MapPin, X, Zap } from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { cardTheme, shiftEmoji } from "@/config/shiftTheme";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Shift } from "@/types/shift";

/**
 * Bottom sheet that surfaces the tapped pin's shift. Slides up with GSAP, taps
 * through to the full detail screen. Rendered only while a shift is selected.
 */
export default function ShiftMapSheet({
  shift,
  onClose,
}: {
  shift: Shift;
  onClose: () => void;
}) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const theme = cardTheme(shift.id);
  const biz = shift.business_profiles;
  const remaining = Math.max(shift.capacity - shift.filled, 0);

  // Re-run on shift change so switching pins re-animates the sheet.
  useGSAP(
    () => {
      gsap.fromTo(
        sheetRef.current,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.5, ease: "power3.out" },
      );
      gsap.fromTo(scope.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
    },
    { scope, dependencies: [shift.id] },
  );

  return (
    <div ref={scope} className="absolute inset-0 z-20 flex flex-col justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/20"
      />

      <div
        ref={sheetRef}
        className="relative mx-3 mb-3 overflow-hidden rounded-[26px] border border-border bg-surface shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.4)]"
      >
        {/* Colored hero strip */}
        <div className="relative h-20 overflow-hidden px-4" style={{ background: theme.gradient }}>
          <span className="pointer-events-none absolute -bottom-3 right-3 select-none text-[72px] leading-none opacity-25">
            {shiftEmoji(shift)}
          </span>
          <div className="relative flex items-center gap-2.5 pt-3">
            <BusinessAvatar name={biz.business_name} logo={biz.logo_url} size={40} />
            <p className="flex items-center gap-1 truncate text-[15px] font-bold text-ink">
              <span className="truncate">{biz.business_name}</span>
              {biz.verification_status === "verified" ? (
                <BadgeCheck size={15} className="shrink-0 text-sky" />
              ) : null}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-ink active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold leading-snug text-ink">{shift.title}</h2>
            {shift.shift_type === "instant" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">
                <Zap size={12} className="fill-current" /> Instant
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-end justify-between">
            <p className="text-[24px] font-extrabold leading-none text-ink">
              {formatTaka(shift.pay_amount)}
              <span className="ml-1 text-[12px] font-medium text-text-tertiary">/ shift</span>
            </p>
            {shift.is_full ? (
              <span className="rounded-full bg-black/5 px-3 py-1.5 text-[12px] font-semibold text-text-secondary">
                Full
              </span>
            ) : remaining <= 3 ? (
              <span className="rounded-full bg-warning/20 px-3 py-1.5 text-[12px] font-semibold text-text-muted">
                {remaining} spots left
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon={MapPin} value={shift.zones?.name ?? shift.address ?? "Location TBA"} />
            <Chip icon={CalendarDays} value={formatShiftDate(shift.shift_date)} />
            <Chip icon={Clock} value={formatTimeRange(shift.start_time, shift.end_time)} />
          </div>

          <button
            type="button"
            onClick={() => router.push(`/shifts/${shift.id}`)}
            className="mt-4 w-full rounded-2xl bg-brand py-3.5 text-[15px] font-bold text-ink active:scale-[0.99]"
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, value }: { icon: typeof Clock; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12px] font-semibold text-ink">
      <Icon size={13} className="shrink-0 text-text-tertiary" /> {value}
    </span>
  );
}
