import { Check } from "lucide-react";

type Props = {
  /** Zero-based index of the active step. */
  current: number;
  /** Total number of steps. */
  total: number;
  /** Short labels, one per step (used for the dot row). */
  labels: string[];
};

/** Encouraging copy keyed off completion percentage. */
function cheer(pct: number): string {
  if (pct >= 100) return "All done — you're a star! 🌟";
  if (pct >= 75) return "Almost there! 🚀";
  if (pct >= 50) return "Halfway done! 🔥";
  if (pct >= 25) return "Great start! 💪";
  return "Let's build your profile ✨";
}

/**
 * Playful onboarding progress header: an animated fill bar, a live percentage,
 * encouraging copy, and a row of step dots that tick off as the user advances.
 */
export default function StepProgress({ current, total, labels }: Props) {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="pt-2">
      <div className="flex items-end justify-between">
        <span className="text-[13px] font-semibold text-text-secondary">{cheer(pct)}</span>
        <span className="text-[13px] font-bold text-ink">{pct}%</span>
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${Math.max(pct, 6)}%` }}
        />
      </div>

      <ol className="mt-3 flex items-center justify-between">
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  done
                    ? "bg-emerald text-white"
                    : active
                      ? "bg-ink text-white"
                      : "bg-black/[0.06] text-text-tertiary"
                }`}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-ink" : "text-text-tertiary"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
