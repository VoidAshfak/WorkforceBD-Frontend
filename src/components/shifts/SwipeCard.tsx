import { BadgeCheck, Bus, CalendarDays, Clock, MapPin, UtensilsCrossed, Zap } from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { cardTheme, shiftEmoji } from "@/config/shiftTheme";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import type { Shift } from "@/types/shift";

/**
 * A single full-bleed deck card: a colorful hero (gradient + floating blobs +
 * a giant category emoji watermark) over a clean white info sheet. Purely
 * presentational — drag/animation live in {@link SwipeDeck}.
 */
export default function SwipeCard({ shift }: { shift: Shift }) {
  const theme = cardTheme(shift.id);
  const biz = shift.business_profiles;
  const isInstant = shift.shift_type === "instant";
  const remaining = Math.max(shift.capacity - shift.filled, 0);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)]">
      {/* Hero zone — gradient + decorative shapes */}
      <div
        className="relative flex shrink-0 flex-col justify-between overflow-hidden p-5"
        style={{ background: theme.gradient, height: "46%" }}
      >
        <Blob className="-left-10 -top-12 h-40 w-40" color={theme.blob} />
        <Blob className="-right-8 top-16 h-28 w-28" color={theme.blobAlt} />
        <span className="pointer-events-none absolute -bottom-6 right-2 select-none text-[120px] leading-none opacity-25">
          {shiftEmoji(shift)}
        </span>

        <div className="relative flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <BusinessAvatar name={biz.business_name} logo={biz.logo_url} />
            <p className="flex items-center gap-1 truncate text-[15px] font-bold text-ink">
              <span className="truncate">{biz.business_name}</span>
              {biz.verification_status === "verified" ? (
                <BadgeCheck size={16} className="shrink-0 text-sky" />
              ) : null}
            </p>
          </div>
          {isInstant ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">
              <Zap size={12} className="fill-current" /> Instant
            </span>
          ) : null}
        </div>

        <h2 className="relative text-2xl font-extrabold leading-tight text-ink">{shift.title}</h2>
      </div>

      {/* Info sheet */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[28px] font-extrabold leading-none text-ink">
              {formatTaka(shift.pay_amount)}
            </p>
            <p className="mt-1 text-[12px] text-text-tertiary">per shift</p>
          </div>
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

        <div className="grid grid-cols-2 gap-2.5">
          <Fact icon={CalendarDays} value={formatShiftDate(shift.shift_date)} />
          <Fact icon={Clock} value={formatTimeRange(shift.start_time, shift.end_time)} />
          <Fact
            icon={MapPin}
            value={shift.zones?.name ?? shift.address ?? "Location TBA"}
          />
          <Fact icon={UtensilsCrossed} value={`${shift.filled}/${shift.capacity} filled`} />
        </div>

        {shift.description ? (
          <p className="line-clamp-2 text-[13px] leading-5 text-text-secondary">
            {shift.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2">
          {shift.meal_included ? (
            <Perk icon={UtensilsCrossed} label="Meal" />
          ) : null}
          {shift.transport_support ? <Perk icon={Bus} label="Transport" /> : null}
        </div>
      </div>
    </div>
  );
}

function Blob({ className, color }: { className: string; color: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-full opacity-50 blur-2xl ${className}`}
      style={{ background: color }}
    />
  );
}

function Fact({ icon: Icon, value }: { icon: typeof Clock; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/[0.03] px-3 py-2.5">
      <Icon size={16} className="shrink-0 text-text-tertiary" />
      <span className="truncate text-[13px] font-semibold text-ink">{value}</span>
    </div>
  );
}

function Perk({ icon: Icon, label }: { icon: typeof Bus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1.5 text-[12px] font-semibold text-emerald">
      <Icon size={13} /> {label}
    </span>
  );
}
