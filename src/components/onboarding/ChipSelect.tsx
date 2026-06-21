import type { CatalogItem } from "@/types/worker";

type Props = {
  items: CatalogItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Emoji prefix for each chip (defaults to a location pin). */
  prefix?: string;
};

/**
 * Wrapping pill multi-select for catalog items (e.g. preferred work zones).
 * Selected pills flip to the brand fill. Renders nothing when the catalog is
 * empty so callers don't need an extra guard.
 */
export default function ChipSelect({ items, selectedIds, onToggle, prefix = "📍" }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={selected}
            className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors active:scale-95 ${
              selected
                ? "border-ink bg-brand text-ink"
                : "border-border bg-surface text-text-secondary hover:border-ink/30"
            }`}
          >
            <span className="mr-1">{prefix}</span>
            {item.name}
          </button>
        );
      })}
    </div>
  );
}
