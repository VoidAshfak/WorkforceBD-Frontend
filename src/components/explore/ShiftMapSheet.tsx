"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ChevronUp,
  ChevronDown,
  Clock,
  Loader2,
  Map,
  MapPin,
  Navigation,
  X,
  Zap,
} from "lucide-react";

import { BusinessAvatar } from "@/components/shifts/ShiftCard";
import { cardTheme, shiftEmoji } from "@/config/shiftTheme";
import { formatShiftDate, formatTaka, formatTimeRange } from "@/lib/format";
import { gsap, useGSAP } from "@/lib/gsap";
import { googleMapsDirUrl, routeSummary, shiftLatLng, type RouteStatus } from "@/lib/geo";
import type { Shift } from "@/types/shift";

type Props = {
  shift: Shift;
  onClose: () => void;
  /** Draw an in-app route to this shift from the worker's current location. */
  onDirections: () => void;
  /** Tear the route down (keeps the shift selected). */
  onStopDirections: () => void;
  /** Expand the collapsed floating bar back to the full sheet. */
  onExpand: () => void;
  /** Collapse the full sheet to the floating bar (used while routing). */
  onMinimize: () => void;
  /** True while this shift's route is shown on the map. */
  directionsActive: boolean;
  /** True when the sheet should render as the compact floating bar. */
  collapsed: boolean;
  /** Live route progress, shown in the bar / directions button. */
  routeStatus: RouteStatus | null;
};

/** Short status line for the active route. */
function routeText(status: RouteStatus | null): string {
  if (!status || status.state === "loading") return "Finding route…";
  if (status.state === "error") return status.message;
  return `${routeSummary(status.distanceM, status.durationS)}${status.fallback ? " · approx" : ""}`;
}

/**
 * Surfaces the tapped pin's shift. While a route is drawn it collapses to a
 * compact floating bar (so it never covers the map) that expands on tap and
 * carries a stop-✕; otherwise it's a full slide-up sheet with directions,
 * Google Maps hand-off, and a link to the detail screen. GSAP-animated.
 */
export default function ShiftMapSheet({
  shift,
  onClose,
  onDirections,
  onStopDirections,
  onExpand,
  onMinimize,
  directionsActive,
  collapsed,
  routeStatus,
}: Props) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const theme = cardTheme(shift.id);
  const biz = shift.business_profiles;
  const remaining = Math.max(shift.capacity - shift.filled, 0);
  const accepted = shift.my_application?.status === "accepted";
  const gmapsUrl = googleMapsDirUrl(shiftLatLng(shift));
  const loading = directionsActive && (!routeStatus || routeStatus.state === "loading");

  // Re-run on shift change and on collapse/expand so the visible panel slides in.
  useGSAP(
    () => {
      gsap.fromTo(
        panelRef.current,
        { yPercent: 120, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" },
      );
    },
    { scope, dependencies: [shift.id, collapsed] },
  );

  // Collapsed: a compact floating bar. The surrounding layer is click-through
  // (pointer-events-none) so the map stays draggable; only the bar is active.
  if (collapsed) {
    return (
      <div
        ref={scope}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3"
      >
        <div
          ref={panelRef}
          className="pointer-events-auto flex w-full items-center gap-2 rounded-[22px] border border-border bg-surface/95 p-2 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand shift details"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1.5 py-1 text-left active:scale-[0.99]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px]"
              style={{ background: theme.gradient }}
            >
              {shiftEmoji(shift)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold text-ink">{shift.title}</span>
              <span className="flex items-center gap-1 text-[12px] font-semibold text-sky">
                {loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Navigation size={12} className="fill-current" />
                )}
                <span className="truncate">{routeText(routeStatus)}</span>
              </span>
            </span>
            <ChevronUp size={18} className="shrink-0 text-text-tertiary" />
          </button>
          <button
            type="button"
            onClick={onStopDirections}
            aria-label="Stop directions"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={scope} className="absolute inset-0 z-20 flex flex-col justify-end">
      {/* Backdrop — while routing it minimizes (keeps the route); else closes. */}
      <button
        type="button"
        aria-label={directionsActive ? "Minimize" : "Close"}
        onClick={directionsActive ? onMinimize : onClose}
        className="absolute inset-0 bg-black/20"
      />

      <div
        ref={panelRef}
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
            <div className="flex shrink-0 flex-col items-end gap-1">
              {accepted ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald/10 px-2.5 py-1 text-[11px] font-bold text-emerald">
                  <BadgeCheck size={12} /> Hired
                </span>
              ) : null}
              {shift.shift_type === "instant" ? (
                <span className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">
                  <Zap size={12} className="fill-current" /> Instant
                </span>
              ) : null}
            </div>
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

          {/* Directions: in-app route (left) + hand off to Google Maps (right).
              While routing, the left button minimizes the sheet to reveal the map. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {directionsActive ? (
              <button
                type="button"
                onClick={onMinimize}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-sky py-3 text-[14px] font-bold text-white active:scale-[0.99]"
              >
                <ChevronDown size={16} /> Show route
              </button>
            ) : (
              <button
                type="button"
                onClick={onDirections}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-ink py-3 text-[14px] font-bold text-white active:scale-[0.99]"
              >
                <Navigation size={16} /> Directions
              </button>
            )}
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-[14px] font-bold text-ink active:scale-[0.99]"
            >
              <Map size={16} /> Google Maps
            </a>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/shifts/${shift.id}`)}
            className="mt-2 w-full rounded-2xl bg-brand py-3.5 text-[15px] font-bold text-ink active:scale-[0.99]"
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
