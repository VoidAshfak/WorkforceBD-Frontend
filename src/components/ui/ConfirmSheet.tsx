"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

import Button from "@/components/ui/Button";
import { gsap, useGSAP } from "@/lib/gsap";

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
 * Reusable bottom-sheet confirmation drawer. Slides up from the bottom over a
 * dimmed backdrop (GSAP), traps nothing heavy — just a title, optional body, and
 * cancel/confirm actions. Controlled via `open`; stays mounted through its exit
 * animation so the close is smooth. Style per-use with `tone`, `icon`, and
 * `className`, or pass `children` for a custom body.
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
  const scope = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Stay mounted while the exit animation plays.
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  // Lock background scroll while visible.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useGSAP(
    () => {
      const backdrop = backdropRef.current;
      const panel = panelRef.current;
      if (!backdrop || !panel) return;

      if (open) {
        gsap.set(backdrop, { autoAlpha: 0 });
        gsap.set(panel, { yPercent: 100 });
        gsap.to(backdrop, { autoAlpha: 1, duration: 0.25, ease: "power1.out" });
        gsap.to(panel, { yPercent: 0, duration: 0.42, ease: "power3.out" });
      } else {
        gsap
          .timeline({ onComplete: () => setMounted(false) })
          .to(panel, { yPercent: 100, duration: 0.3, ease: "power2.in" }, 0)
          .to(backdrop, { autoAlpha: 0, duration: 0.3, ease: "power1.in" }, 0);
      }
    },
    { scope, dependencies: [open, mounted] },
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    // Constrain to the centered phone-width frame (matches the app's mobile
    // shell in src/app/layout.tsx) so the sheet sits inside the device, not the
    // whole browser window.
    <div
      ref={scope}
      className="fixed inset-0 z-[60] flex justify-center py-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem]">
        <div
          ref={backdropRef}
          onClick={() => !loading && onClose()}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={panelRef}
          className={`absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-border bg-surface px-5 pb-6 pt-3 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.45)] ${className}`}
        >
        {/* Grab handle */}
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />

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
          <Button
            fullWidth
            loading={loading}
            onClick={onConfirm}
            className={CONFIRM_TONE[tone]}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" fullWidth disabled={loading} onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
