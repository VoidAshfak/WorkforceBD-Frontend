"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPinned, RefreshCw } from "lucide-react";

import FilterTabs from "@/components/shifts/FilterTabs";
import ShiftMapSheet from "@/components/explore/ShiftMapSheet";
import { useGetShiftsQuery } from "@/store/api/shiftsApi";
import type { RouteStatus } from "@/lib/geo";
import type { ShiftFilter } from "@/types/shift";

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

      {/* Floating header + filters (transparent to map drags except the pills). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-5">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-surface/90 px-4 py-2 shadow-md backdrop-blur">
          <MapPinned size={16} className="text-ink" />
          <span className="text-[14px] font-bold text-ink">Shifts near you</span>
        </div>
        <div className="pointer-events-auto mt-3">
          <FilterTabs active={filter} onChange={changeFilter} />
        </div>
      </div>

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
