"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Compass, RefreshCw, Sparkles } from "lucide-react";

import FilterTabs from "@/components/shifts/FilterTabs";
import SwipeDeck from "@/components/shifts/SwipeDeck";
import BusinessHome from "@/components/business/BusinessHome";
import { useAppSelector } from "@/store/hooks";
import { useGetShiftsQuery } from "@/store/api/shiftsApi";
import type { ShiftFilter } from "@/types/shift";

/**
 * Home — the worker's primary discovery surface: a full-screen swipe deck of
 * shifts (drag left/right to browse, tap for details). A slim greeting and an
 * optional verification nudge sit above it. Business accounts get a placeholder
 * until the business home is built. (The map-based browse lives on /explore.)
 */
export default function HomePage() {
  const { user, activeRole, profile } = useAppSelector((s) => s.auth);

  if (activeRole === "business") {
    return (
      <BusinessHome
        name={user?.full_name?.split(" ")[0]}
        hasProfile={profile?.exists ?? false}
        status={profile?.verification_status}
      />
    );
  }

  return (
    <WorkerHome
      name={user?.full_name?.split(" ")[0]}
      status={profile?.verification_status}
      nextStep={profile?.next_step}
    />
  );
}

function WorkerHome({
  name,
  status,
  nextStep,
}: {
  name?: string;
  status?: string;
  nextStep?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ShiftFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useGetShiftsQuery({
    filter,
    page,
    limit: 10,
  });

  const changeFilter = (next: ShiftFilter) => {
    setFilter(next);
    setPage(1);
  };

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;
  const verified = status === "verified";

  return (
    <div className="flex h-full flex-col px-5 pt-4">
      <header className="shrink-0">
        <h1 className="truncate text-xl font-bold text-ink">
          {name ? `Hey, ${name} 👋` : "Find your next shift"}
        </h1>
      </header>

      {!verified ? (
        <div className="pt-2.5">
          <VerificationBanner
            status={status}
            nextStep={nextStep}
            onResume={() => router.push("/onboarding/worker")}
          />
        </div>
      ) : null}

      <div className="pt-2.5">
        <FilterTabs active={filter} onChange={changeFilter} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-visible pt-3 pb-5">
        {isLoading ? (
          <DeckSkeleton />
        ) : isError && items.length === 0 ? (
          <ErrorState filter={filter} onRetry={() => refetch()} />
        ) : items.length > 0 ? (
          // Remount on filter change so the deck index resets to the top.
          <SwipeDeck
            key={filter}
            items={items}
            hasMore={hasMore}
            isFetching={isFetching}
            verified={verified}
            onNeedMore={() => setPage((p) => p + 1)}
          />
        ) : (
          <EmptyState filter={filter} />
        )}
      </div>
    </div>
  );
}

function VerificationBanner({
  status,
  nextStep,
  onResume,
}: {
  status?: string;
  nextStep?: string | null;
  onResume: () => void;
}) {
  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-warning/15 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/30 text-text-muted">
          <Clock size={16} />
        </span>
        <div>
          <p className="text-[14px] font-bold text-ink">Under review</p>
          <p className="text-[12px] text-text-secondary">
            We&apos;re verifying your profile. You can apply once approved.
          </p>
        </div>
      </div>
    );
  }

  // unverified / rejected → push them to finish onboarding.
  return (
    <button
      type="button"
      onClick={onResume}
      className="flex w-full items-center gap-3 rounded-2xl bg-brand p-3.5 text-left active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <Sparkles size={16} />
      </span>
      <span className="flex-1">
        <span className="block text-[14px] font-bold text-ink">
          {status === "rejected" ? "Re-submit your documents" : "Finish your profile to apply"}
        </span>
        <span className="block text-[12px] text-text-muted">
          {nextStep ? "Just a few steps left" : "Get verified to unlock shifts"}
        </span>
      </span>
    </button>
  );
}

function DeckSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 animate-pulse overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_28px_60px_-22px_rgba(0,0,0,0.45)]">
          <div className="h-[50%] bg-black/[0.06]" />
          <div className="-mt-9 px-6">
            <div className="h-16 rounded-[22px] bg-black/[0.08]" />
          </div>
          <div className="space-y-3 p-6 pt-4">
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 rounded-2xl bg-black/[0.06]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ filter, onRetry }: { filter: ShiftFilter; onRetry: () => void }) {
  // `nearby` 500s on the backend when the worker has no preferred zones; surface
  // that as the likely cause rather than a generic failure.
  const isNearby = filter === "nearby";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15">
        <RefreshCw size={20} className="text-text-muted" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">
        {isNearby
          ? "Couldn’t load nearby shifts. Add preferred zones in your profile, or try again."
          : "Couldn’t load shifts right now. Please try again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white active:scale-95"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ filter }: { filter: ShiftFilter }) {
  const message =
    filter === "nearby"
      ? "No nearby shifts yet. Add preferred zones in your profile to see them here."
      : filter === "urgent"
        ? "Nothing urgent right now. Check back soon ⚡"
        : filter === "high_pay"
          ? "No high-pay shifts open at the moment 💰"
          : "No shifts open right now. Check back soon ✨";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-surface p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <Compass size={22} className="text-ink" />
      </span>
      <p className="max-w-xs text-[14px] text-text-secondary">{message}</p>
    </div>
  );
}
