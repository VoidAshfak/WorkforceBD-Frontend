/** Loading placeholder matching the ShiftCard footprint to avoid layout shift. */
export default function ShiftCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-10 w-10 animate-pulse rounded-full bg-black/[0.06]" />
          <div className="space-y-1.5">
            <span className="block h-3 w-24 animate-pulse rounded bg-black/[0.06]" />
            <span className="block h-2.5 w-16 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
        <span className="h-5 w-14 animate-pulse rounded bg-black/[0.06]" />
      </div>
      <div className="mt-3 min-h-[44px] space-y-2">
        <span className="block h-4 w-3/4 animate-pulse rounded bg-black/[0.06]" />
        <span className="block h-4 w-1/2 animate-pulse rounded bg-black/[0.06]" />
      </div>
      <span className="mt-2 block h-3 w-1/2 animate-pulse rounded bg-black/[0.06]" />
      <div className="mt-3 flex min-h-[28px] gap-2">
        <span className="h-6 w-16 animate-pulse rounded-full bg-black/[0.06]" />
        <span className="h-6 w-16 animate-pulse rounded-full bg-black/[0.06]" />
      </div>
    </div>
  );
}
