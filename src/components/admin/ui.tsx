"use client";

import { useEffect } from "react";
import { Inbox, Loader2, X, type LucideIcon } from "lucide-react";

/**
 * Shared building blocks for the admin dashboard. Desktop-flavoured (tables,
 * modals, dense cards) — the mobile app's `BottomSheet`/`Button` primitives stay
 * where they belong. All colors come from the theme tokens in globals.css.
 */

/* --------------------------------- Layout -------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-border bg-surface ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3.5">
      <h2 className="text-[14px] font-bold text-ink">{title}</h2>
      {hint ? <span className="text-[12px] text-text-tertiary">{hint}</span> : null}
    </div>
  );
}

/* ---------------------------------- Bits ---------------------------------- */

type Tone = "neutral" | "brand" | "success" | "danger" | "warning" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-black/[0.05] text-text-secondary",
  brand: "bg-brand text-ink",
  success: "bg-emerald/10 text-emerald",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/25 text-text-muted",
  info: "bg-sky/10 text-sky",
};

export function Pill({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11px] font-bold ${TONE[tone]}`}
    >
      {Icon ? <Icon size={12} /> : null}
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-ink text-white hover:bg-ink-soft",
    secondary: "border border-border bg-surface text-ink hover:bg-black/[0.04]",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-text-secondary hover:bg-black/[0.05]",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2.5 text-[14px]"
      } ${variants[variant]}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/* --------------------------------- Table ---------------------------------- */

export function Table({
  head,
  children,
}: {
  head: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {head.map((h) => (
              <th
                key={h}
                className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-tertiary"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/70 text-[13.5px] text-ink last:border-0 hover:bg-black/[0.015]">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3.5 align-middle ${className}`}>{children}</td>;
}

/* ------------------------------ Async states ------------------------------ */

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 rounded bg-black/[0.06]" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04]">
        <Icon size={19} className="text-text-tertiary" />
      </span>
      <p className="text-[13.5px] text-text-secondary">{message}</p>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-[12.5px] font-medium text-danger">{message}</p>;
}

/* ------------------------------- Pagination -------------------------------- */

export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <span className="text-[12.5px] text-text-tertiary">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${width} max-h-[88vh] overflow-y-auto rounded-card border border-border bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)]`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-black/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Inputs ---------------------------------- */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-text-tertiary">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-input border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-ink";

/** Segmented filter control — the dashboard's standard queue switcher. */
export function Segmented<T extends string | number | undefined>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-pill border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            o.value === value ? "bg-ink text-white" : "text-text-secondary hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
