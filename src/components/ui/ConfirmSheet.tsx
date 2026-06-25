"use client";

import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";

export type ConfirmTone = "default" | "danger";

type ConfirmSheetProps = {
  /** Controlled visibility. The sheet animates in/out as this flips. */
  open: boolean;
  /** Called on cancel, backdrop tap, or Escape. */
  onClose: () => void;
  /** Called when the confirm button is pressed. Parent closes after its work. */
  onConfirm: () => void;
  title: string;
  /** One-liner under the title. Ignored when `children` is provided. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red — for destructive actions. */
  tone?: ConfirmTone;
  /** Spinner + disabled state on the confirm button while an action runs. */
  loading?: boolean;
  /** Optional icon shown in a tinted circle above the title. */
  icon?: LucideIcon;
  /** Custom body — replaces `description` for richer content. */
  children?: ReactNode;
  /** Extra classes on the panel for one-off styling. */
  className?: string;
};

const CONFIRM_TONE: Record<ConfirmTone, string> = {
  default: "",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
};

const ICON_TONE: Record<ConfirmTone, string> = {
  default: "bg-brand-light text-ink",
  danger: "bg-danger/10 text-danger",
};

/**
 * Reusable bottom-sheet confirmation drawer. Built on {@link BottomSheet} — a
 * title, optional body, and cancel/confirm actions. Controlled via `open`.
 * Style per-use with `tone`, `icon`, and `className`, or pass `children` for a
 * custom body.
 *
 * @example
 * <ConfirmSheet
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onConfirm={doThing}
 *   title="Withdraw this application?"
 *   description="This is permanent — you can't apply to this shift again."
 *   confirmLabel="Withdraw"
 *   tone="danger"
 *   loading={isLoading}
 * />
 */
export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  loading = false,
  icon: Icon,
  children,
  className = "",
}: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} locked={loading} className={className}>
      {Icon ? (
        <span
          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${ICON_TONE[tone]}`}
        >
          <Icon size={22} />
        </span>
      ) : null}

      <h2 className="text-[18px] font-bold text-ink">{title}</h2>
      {children ? (
        <div className="mt-1.5 text-[14px] text-text-secondary">{children}</div>
      ) : description ? (
        <p className="mt-1.5 text-[14px] leading-5 text-text-secondary">{description}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2.5">
        <Button fullWidth loading={loading} onClick={onConfirm} className={CONFIRM_TONE[tone]}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" fullWidth disabled={loading} onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
