"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { gsap, useGSAP } from "@/lib/gsap";

type BottomSheetProps = {
  /** Controlled visibility. The sheet animates in/out as this flips. */
  open: boolean;
  /** Called on backdrop tap or Escape. */
  onClose: () => void;
  /** When true, backdrop tap and Escape are ignored (a blocking action runs). */
  locked?: boolean;
  /** Sheet body. */
  children: ReactNode;
  /** Extra classes on the panel for one-off styling. */
  className?: string;
};

/**
 * Animated bottom-sheet shell. Slides a panel up from the bottom over a dimmed
 * backdrop (GSAP), constrained to the centered phone-width frame (matches the
 * app's mobile shell in src/app/layout.tsx) so it sits inside the device, not
 * the whole browser window. Stays mounted through its exit animation so the
 * close is smooth. Handles Escape, backdrop-tap, body-scroll lock, and the grab
 * handle — callers just provide the body.
 */
export default function BottomSheet({
  open,
  onClose,
  locked = false,
  children,
  className = "",
}: BottomSheetProps) {
  const scope = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Stay mounted while the exit animation plays. Mounting on open is an
  // adjust-state-during-render convergence (not an effect) so it commits before
  // paint with no cascading-render lint warning.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  // Close on Escape while open (unless locked).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, onClose]);

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
    <div
      ref={scope}
      className="fixed inset-0 z-[60] flex justify-center py-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem]">
        <div
          ref={backdropRef}
          onClick={() => !locked && onClose()}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        />

        <div
          ref={panelRef}
          className={`absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-border bg-surface px-5 pb-6 pt-3 shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.45)] ${className}`}
        >
          {/* Grab handle */}
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15" />
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
