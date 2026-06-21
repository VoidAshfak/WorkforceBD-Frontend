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
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
              isActive
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface text-text-secondary hover:border-ink/30"
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
