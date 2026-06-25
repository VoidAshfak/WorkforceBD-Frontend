"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Check, ChevronDown, Loader2, MapPinned, RefreshCw, SlidersHorizontal } from "lucide-react";

import ShiftMapSheet from "@/components/explore/ShiftMapSheet";
import BottomSheet from "@/components/ui/BottomSheet";
import { useGetShiftsQuery } from "@/store/api/shiftsApi";
import type { RouteStatus } from "@/lib/geo";
import type { ShiftFilter } from "@/types/shift";

/** Discovery filters, surfaced in the explore filter sheet. */
const FILTERS: { value: ShiftFilter; label: string; emoji: string; desc: string }[] = [
  { value: "all", label: "All shifts", emoji: "✨", desc: "Everything open near you" },
  { value: "nearby", label: "Nearby", emoji: "📍", desc: "Closest to your preferred zones" },
  { value: "urgent", label: "Urgent", emoji: "⚡", desc: "Starting soon or instant hire" },
  { value: "high_pay", label: "High pay", emoji: "💰", desc: "Best-paying shifts first" },
];

// MapLibre touches `window` at import — load it client-only.
const ExploreMap = dynamic(() => import("@/components/explore/ExploreMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

/**
 * Explore — an interactive map of open shifts. Each shift is a brand pin; tap a
 * pin to preview it in a slide-up sheet, then open the full detail. Filter pills
 * float over the map; the swipe-deck discovery lives on Home.
 */
export default function ExplorePage() {
  const [filter, setFilter] = useState<ShiftFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directionsId, setDirectionsId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus | null>(null);
  // While a route is drawn the sheet collapses to a floating bar so it doesn't
  // cover the map; tapping the bar expands it again.
  const [collapsed, setCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilter = FILTERS.find((f) => f.value === filter) ?? FILTERS[0];

  // A wide single page is plenty for a map view.
  const { data, isLoading, isError, refetch } = useGetShiftsQuery({ filter, page: 1, limit: 50 });
  const shifts = useMemo(() => data?.items ?? [], [data]);

  const selected = selectedId ? shifts.find((s) => s.id === selectedId) ?? null : null;

  const resetSelection = () => {
    setSelectedId(null);
    setDirectionsId(null);
    setRouteStatus(null);
    setCollapsed(false);
  };

  const changeFilter = (next: ShiftFilter) => {
    setFilter(next);
    resetSelection();
  };

  // Picking a different pin drops any route from the previous one.
  const selectShift = (id: string) => {
    setSelectedId(id);
    setDirectionsId(null);
    setRouteStatus(null);
    setCollapsed(false);
  };

  // Start the in-app route and collapse the sheet out of the way.
  const startDirections = () => {
    if (!selected) return;
    setDirectionsId(selected.id);
    setCollapsed(true);
  };

  // Stop the route but keep the shift selected (sheet returns expanded).
  const stopDirections = () => {
    setDirectionsId(null);
    setRouteStatus(null);
    setCollapsed(false);
  };

  const closeSheet = resetSelection;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!isLoading && !isError && shifts.length > 0 ? (
        <ExploreMap
          shifts={shifts}
          selectedId={selectedId}
          onSelect={selectShift}
          directionsId={directionsId}
          onRouteStatus={setRouteStatus}
        />
      ) : (
        <MapLoading
          empty={!isLoading && !isError && shifts.length === 0}
          error={isError}
          filter={filter}
          onRetry={() => refetch()}
        />
      )}

      {/* Single floating filter button — opens the picker sheet. Keeps the map
          clear instead of a full pill row. */}
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-surface/90 py-2 pl-3 pr-3.5 shadow-md backdrop-blur-md active:scale-95"
      >
        <SlidersHorizontal size={15} className="text-ink" />
        <span className="text-[14px] font-bold text-ink">
          {activeFilter.emoji} {activeFilter.label}
        </span>
        <ChevronDown size={15} className="text-text-tertiary" />
      </button>

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <h2 className="text-[18px] font-bold text-ink">Filter shifts</h2>
        <p className="mt-0.5 text-[13px] text-text-secondary">Choose what shows on the map.</p>
        <div className="mt-4 flex flex-col gap-2">
          {FILTERS.map((f) => {
            const isActive = f.value === filter;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  changeFilter(f.value);
                  setFilterOpen(false);
                }}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:scale-[0.99] ${
                  isActive ? "border-ink bg-brand/15" : "border-border bg-surface"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-[18px]">
                  {f.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-ink">{f.label}</span>
                  <span className="block truncate text-[12px] text-text-secondary">{f.desc}</span>
                </span>
                {isActive ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {selected ? (
        <ShiftMapSheet
          shift={selected}
          onClose={closeSheet}
          onDirections={startDirections}
          onStopDirections={stopDirections}
          onExpand={() => setCollapsed(false)}
          onMinimize={() => setCollapsed(true)}
          directionsActive={directionsId === selected.id}
          collapsed={collapsed && directionsId === selected.id}
          routeStatus={routeStatus}
        />
      ) : null}
    </div>
  );
}

function MapLoading({
  empty = false,
  error = false,
  filter,
  onRetry,
}: {
  empty?: boolean;
  error?: boolean;
  filter?: ShiftFilter;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#FBF8F0] px-8 text-center">
      {error ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
            <RefreshCw size={22} className="text-text-muted" />
          </span>
          <p className="text-[15px] font-semibold text-ink">Couldn’t load the map</p>
          <p className="max-w-xs text-[13px] text-text-secondary">
            {filter === "nearby"
              ? "Nearby needs preferred zones on your profile. Add them, or try again."
              : "Something went wrong fetching shifts. Please try again."}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white active:scale-95"
            >
              Retry
            </button>
          ) : null}
        </>
      ) : empty ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
            <MapPinned size={24} className="text-ink" />
          </span>
          <p className="text-[15px] font-semibold text-ink">No shifts to map</p>
          <p className="max-w-xs text-[13px] text-text-secondary">
            {filter === "nearby"
              ? "No nearby shifts yet — add preferred zones in your profile."
              : "Nothing open for this filter right now. Try another."}
          </p>
        </>
      ) : (
        <>
          <Loader2 size={26} className="animate-spin text-ink/50" />
          <p className="text-[13px] text-text-secondary">Loading the map…</p>
        </>
      )}
    </div>
  );
}
