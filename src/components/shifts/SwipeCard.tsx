import {
  BadgeCheck,
  Bus,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
  UtensilsCrossed,
  X,
  Zap,
} from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { cardTheme, shiftEmoji } from "@/config/shiftTheme";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import type { ApplicationStatus, Shift } from "@/types/shift";

/** The worker's own application state, shown as a hero pill on the deck card. */
function appliedPill(
  status?: ApplicationStatus,
): { label: string; text: string; icon: typeof Check } | null {
  switch (status) {
    case "pending":
    case "shortlisted":
      return { label: "Applied", text: "text-sky", icon: Check };
    case "accepted":
      return { label: "Hired", text: "text-emerald", icon: BadgeCheck };
    case "withdrawn":
      return { label: "Withdrawn", text: "text-text-secondary", icon: X };
    case "rejected":
      return { label: "Not selected", text: "text-danger", icon: X };
    case "no_show":
      return { label: "No show", text: "text-danger", icon: X };
    default:
      return { label: "Applied", text: "text-sky", icon: Check };
  }
}

/**
 * A single full-bleed deck card — the star of the Home tab. A bold gradient hero
 * (floating blobs + a giant category emoji watermark) flows into a clean info
 * sheet, with the pay rendered as an oversized "magnet" pill straddling the two
 * so it's the first thing the eye lands on. A fill-progress bar and a details
 * footer give the larger card body life. Purely presentational — drag and stack
 * animation live in {@link SwipeDeck}.
 */
export default function SwipeCard({ shift }: { shift: Shift }) {
  const theme = cardTheme(shift.id);
  const biz = shift.business_profiles;
  const isInstant = shift.shift_type === "instant";
  const remaining = Math.max(shift.capacity - shift.filled, 0);
  const almostGone = !shift.is_full && remaining > 0 && remaining <= 3;
  const fillPct = shift.capacity > 0 ? Math.round((shift.filled / shift.capacity) * 100) : 0;
  const category = shift.categories?.name ?? shift.role_type;
  const status = shift.has_applied ? appliedPill(shift.my_application?.status) : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_28px_60px_-22px_rgba(0,0,0,0.45)]">
      {/* Hero zone — gradient + decorative shapes */}
      <div
        className="relative flex shrink-0 flex-col justify-between overflow-hidden p-6 pb-14"
        style={{ background: theme.gradient, height: "50%" }}
      >
        <Blob className="-left-12 -top-14 h-48 w-48" color={theme.blob} />
        <Blob className="-right-10 top-20 h-32 w-32" color={theme.blobAlt} />
        <Blob className="bottom-2 left-1/3 h-24 w-24" color={theme.blob} />
        <span className="pointer-events-none absolute -bottom-8 -right-2 select-none text-[160px] leading-none opacity-25">
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
          <div className="flex shrink-0 items-center gap-1.5">
            {status ? (
              <span
                className={`flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${status.text}`}
              >
                <status.icon size={12} /> {status.label}
              </span>
            ) : null}
            {almostGone ? (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-extrabold text-[#E0522B] shadow-sm">
                <Flame size={12} className="fill-current" /> {remaining} left
              </span>
            ) : null}
            {isInstant ? (
              <span className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <Zap size={12} className="fill-current" /> Instant
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative space-y-2.5">
          {category ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-ink/80 backdrop-blur-sm">
              <span>{shiftEmoji(shift)}</span> {category}
            </span>
          ) : null}
          <h2 className="max-w-[88%] text-[27px] font-extrabold leading-[1.1] text-ink drop-shadow-sm">
            {shift.title}
          </h2>
        </div>
      </div>

      {/* Pay magnet — straddles hero and sheet so the eye lands here first. */}
      <div className="relative z-10 -mt-9 px-6">
        <div className="flex items-end justify-between rounded-[22px] border border-border bg-surface px-5 py-3.5 shadow-[0_14px_30px_-16px_rgba(0,0,0,0.4)]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-black leading-none tracking-tight text-ink">
              {formatTaka(shift.pay_amount)}
            </span>
            <span className="text-[13px] font-semibold text-text-tertiary">/ shift</span>
          </div>
          {shift.is_full ? (
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-[12px] font-semibold text-text-secondary">
              Full
            </span>
          ) : (
            <span className="rounded-full bg-emerald/10 px-3 py-1.5 text-[12px] font-bold text-emerald">
              {remaining} spot{remaining === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Info sheet — scrollable content + a pinned footer so every card shows
          the same sections in the same place and the footer is never clipped,
          regardless of how much optional content (description/perks) a shift has. */}
      <div className="flex min-h-0 flex-1 flex-col p-6 pt-5">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-2 gap-2.5">
            <Fact icon={CalendarDays} value={formatShiftDate(shift.shift_date)} />
            <Fact icon={Clock} value={formatTimeRange(shift.start_time, shift.end_time)} />
            <Fact
              icon={MapPin}
              value={shift.zones?.name ?? shift.landmark ?? shift.address ?? "Location TBA"}
            />
            <Fact icon={UtensilsCrossed} value={`${shift.filled}/${shift.capacity} filled`} />
          </div>

          {/* Fill progress — visual sense of how fast the shift is filling. */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold">
              <span className="text-text-secondary">{shift.filled} of {shift.capacity} hired</span>
              <span className={shift.is_full ? "text-text-tertiary" : "text-emerald"}>
                {shift.is_full ? "Filled" : `${remaining} open`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald to-[#1A964A]"
                style={{ width: `${Math.max(fillPct, 4)}%` }}
              />
            </div>
          </div>

          {shift.description ? (
            <p className="line-clamp-3 text-[13px] leading-5 text-text-secondary">
              {shift.description}
            </p>
          ) : null}

          {shift.meal_included || shift.transport_support ? (
            <div className="flex flex-wrap gap-2">
              {shift.meal_included ? <Perk icon={UtensilsCrossed} label="Meal" /> : null}
              {shift.transport_support ? <Perk icon={Bus} label="Transport" /> : null}
            </div>
          ) : null}
        </div>

        {/* Details footer — pinned, always visible. */}
        <div className="mt-4 flex shrink-0 items-center justify-between border-t border-border/70 pt-3.5 text-[13px] font-bold text-ink">
          <span>View full details</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-ink">
            <ChevronRight size={16} />
          </span>
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
