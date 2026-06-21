import { Check } from "lucide-react";

type Props = {
  emoji: string;
  label: string;
  hint?: string;
  selected: boolean;
  onToggle: () => void;
  /** `true` renders the card in a compact, full-width row layout. */
  row?: boolean;
};

/**
 * Big, tappable choice card with an emoji, used across the onboarding steps for
 * gender, skills, days, and time slots. Selected state is brand-yellow with a
 * check badge; meets the 56px touch-target guidance from /docs/DESIGN.md.
 */
export default function SelectableCard({
  emoji,
  label,
  hint,
  selected,
  onToggle,
  row,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
        selected
          ? "border-ink bg-brand shadow-sm"
          : "border-border bg-surface hover:border-ink/30"
      } ${row ? "w-full" : "min-h-[88px] flex-col items-start justify-center"}`}
    >
      <span className={`leading-none ${row ? "text-2xl" : "text-3xl"}`}>{emoji}</span>
      <span className="flex flex-col">
        <span className="text-[15px] font-bold text-ink">{label}</span>
        {hint ? <span className="text-[12px] text-text-secondary">{hint}</span> : null}
      </span>

      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
          <Check size={13} />
        </span>
      ) : null}
    </button>
  );
}
