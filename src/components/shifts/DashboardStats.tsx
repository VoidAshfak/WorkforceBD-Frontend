"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Zap } from "lucide-react";

import type { ShiftDashboard, ShiftFilter } from "@/types/shift";

const CARDS: {
  key: keyof ShiftDashboard;
  label: string;
  filter: ShiftFilter;
  icon: typeof Zap;
  className: string;
}[] = [
  { key: "shifts_today", label: "Today", filter: "all", icon: CalendarDays, className: "bg-brand text-ink" },
  { key: "nearby", label: "Nearby", filter: "nearby", icon: MapPin, className: "bg-emerald/10 text-emerald" },
  { key: "urgent", label: "Urgent", filter: "urgent", icon: Zap, className: "bg-danger/10 text-danger" },
];

/** Three tappable home counters that deep-link into the filtered explore feed. */
export default function DashboardStats({
  data,
  loading,
}: {
  data?: ShiftDashboard;
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => router.push(`/explore?filter=${card.filter}`)}
            className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.98]"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${card.className}`}>
              <Icon size={16} />
            </span>
            {loading ? (
              <span className="h-6 w-8 animate-pulse rounded bg-black/[0.06]" />
            ) : (
              <span className="text-2xl font-bold leading-none text-ink">{data?.[card.key] ?? 0}</span>
            )}
            <span className="text-[12px] font-medium text-text-secondary">{card.label}</span>
          </button>
        );
      })}
    </div>
  );
}
