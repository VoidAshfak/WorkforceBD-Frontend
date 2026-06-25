import Link from "next/link";
import { BadgeCheck, Bus, Check, MapPin, UtensilsCrossed, X, Zap } from "lucide-react";

import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import type { ApplicationStatus, Shift } from "@/types/shift";

/** The worker's own application state, shown as a badge on the card. */
function appliedBadge(
  status?: ApplicationStatus,
): { label: string; className: string; icon: typeof Check } | null {
  switch (status) {
    case "pending":
    case "shortlisted":
      return { label: "Applied", className: "bg-sky/10 text-sky", icon: Check };
    case "accepted":
      return { label: "Hired", className: "bg-emerald/10 text-emerald", icon: BadgeCheck };
    case "withdrawn":
      return { label: "Withdrawn", className: "bg-black/5 text-text-secondary", icon: X };
    case "rejected":
      return { label: "Not selected", className: "bg-danger/10 text-danger", icon: X };
    case "no_show":
      return { label: "No show", className: "bg-danger/10 text-danger", icon: X };
    default:
      // has_applied true but status missing → generic applied.
      return { label: "Applied", className: "bg-sky/10 text-sky", icon: Check };
  }
}

/**
 * Discovery feed card — pay-forward, scannable in one glance (pay, when, where,
 * who) with urgency/perk signals. The whole card links to the shift detail.
 *
 * Layout is fixed-height per section so cards line up regardless of which
 * optional fields a shift carries: the zone line always renders (with a
 * fallback), the title is clamped to two lines, and the badge row keeps a
 * reserved minimum height even when a shift has no badges.
 */
export default function ShiftCard({ shift }: { shift: Shift }) {
  const biz = shift.business_profiles;
  const isInstant = shift.shift_type === "instant";
  const remaining = Math.max(shift.capacity - shift.filled, 0);
  const status = shift.has_applied ? appliedBadge(shift.my_application?.status) : null;

  return (
    <Link
      href={`/shifts/${shift.id}`}
      className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-ink/30 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BusinessAvatar name={biz.business_name} logo={biz.logo_url} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[14px] font-semibold text-ink">
              <span className="truncate">{biz.business_name}</span>
              {biz.verification_status === "verified" ? (
                <BadgeCheck size={15} className="shrink-0 text-sky" />
              ) : null}
            </p>
            <p className="flex items-center gap-0.5 truncate text-[12px] text-text-secondary">
              <MapPin size={12} className="shrink-0" /> {shift.zones?.name ?? "Location TBA"}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[18px] font-bold leading-none text-ink">
            {formatTaka(shift.pay_amount)}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">per shift</p>
        </div>
      </div>

      <h3 className="mt-3 line-clamp-2 min-h-[44px] text-[16px] font-bold leading-snug text-ink">
        {shift.title}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-secondary">
        <span className="font-medium text-ink">{formatShiftDate(shift.shift_date)}</span>
        <span>{formatTimeRange(shift.start_time, shift.end_time)}</span>
      </div>

      <div className="mt-3 flex min-h-[28px] flex-wrap items-center gap-2">
        {status ? (
          <Badge className={status.className}>
            <status.icon size={12} /> {status.label}
          </Badge>
        ) : null}
        {isInstant ? (
          <Badge className="bg-danger/10 text-danger">
            <Zap size={12} className="fill-current" /> Instant
          </Badge>
        ) : null}
        {shift.is_full ? (
          <Badge className="bg-black/5 text-text-secondary">Full</Badge>
        ) : remaining <= 3 ? (
          <Badge className="bg-warning/20 text-text-muted">{remaining} spots left</Badge>
        ) : null}
        {shift.meal_included ? (
          <Badge className="bg-emerald/10 text-emerald">
            <UtensilsCrossed size={12} /> Meal
          </Badge>
        ) : null}
        {shift.transport_support ? (
          <Badge className="bg-sky/10 text-sky">
            <Bus size={12} /> Transport
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function BusinessAvatar({
  name,
  logo,
  size = 40,
}: {
  name: string;
  logo: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-light text-[15px] font-bold text-ink"
      style={{ width: size, height: size }}
    >
      {(name?.trim()?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
