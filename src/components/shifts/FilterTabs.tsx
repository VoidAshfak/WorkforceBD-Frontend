"use client";

import type { ShiftFilter } from "@/types/shift";

const TABS: { value: ShiftFilter; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "nearby", label: "Nearby", emoji: "📍" },
  { value: "urgent", label: "Urgent", emoji: "⚡" },
  { value: "high_pay", label: "High pay", emoji: "💰" },
];

/** Horizontal, scrollable pill filter row for the discovery feed. */
export default function FilterTabs({
  active,
  onChange,
}: {
  active: ShiftFilter;
  onChange: (filter: ShiftFilter) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-bold transition-all duration-200 active:scale-95 ${
              isActive
                ? "bg-brand text-ink shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]"
                : "border border-border/60 bg-surface/80 text-text-secondary backdrop-blur-md hover:text-ink"
            }`}
          >
            <span className={`text-[15px] leading-none ${isActive ? "" : "opacity-80"}`}>{tab.emoji}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
