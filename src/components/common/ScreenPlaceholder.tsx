import type { LucideIcon } from "lucide-react";

/** Temporary tab landing — replaced as each screen is built out. */
export default function ScreenPlaceholder({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand">
        <Icon size={28} className="text-ink" strokeWidth={2.2} />
      </span>
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="max-w-xs text-[15px] leading-6 text-text-secondary">{subtitle}</p>
    </div>
  );
}
