"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";

import SwipeCard from "@/components/shifts/SwipeCard";
import { Draggable, gsap, useGSAP } from "@/lib/gsap";
import type { Shift } from "@/types/shift";

/** Horizontal drag (px) past which a swipe commits to prev/next. */
const THRESHOLD = 110;

/**
 * Full-screen swipe deck for shift discovery. One card at a time; drag (or tap
 * the arrows) left → next, right → previous. Tapping a card opens its detail.
 * Pagination is prefetched as the user nears the end of the loaded set so the
 * deck feels endless. All motion is GSAP via {@link useGSAP} (auto-cleaned).
 */
export default function SwipeDeck({
  items,
  hasMore,
  isFetching,
  onNeedMore,
}: {
  items: Shift[];
  hasMore: boolean;
  isFetching: boolean;
  onNeedMore: () => void;
}) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  // Direction the incoming top card animates from (1 = came from "next").
  const enterDir = useRef<1 | -1>(1);

  const [index, setIndex] = useState(0);

  const total = items.length;
  const current = items[index];
  const peek = items[index + 1];
  const canNext = Boolean(peek);
  const canPrev = index > 0;

  const snapBack = (card: HTMLElement) =>
    gsap.to(card, { x: 0, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.6)" });

  /** Commit a navigation: fling the top card away, then swap the index. */
  const go = (dir: 1 | -1) => {
    const card = topRef.current;
    if (!card || animating.current) return;
    if ((dir === 1 && !canNext) || (dir === -1 && !canPrev)) return snapBack(card);

    animating.current = true;
    gsap.to(card, {
      x: dir * (window.innerWidth + 120),
      rotation: dir * 14,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        const nextIndex = index + dir;
        enterDir.current = dir;
        animating.current = false;
        setIndex(nextIndex);
        // Prefetch the next page while a couple of cards are still in hand.
        if (dir === 1 && hasMore && !isFetching && nextIndex >= total - 2) onNeedMore();
      },
    });
  };

  useGSAP(
    () => {
      const card = topRef.current;
      if (!card) return;

      gsap.fromTo(
        card,
        { x: enterDir.current * 40, scale: 0.92, autoAlpha: 0, rotation: enterDir.current * 5 },
        { x: 0, scale: 1, autoAlpha: 1, rotation: 0, duration: 0.45, ease: "power3.out" },
      );
      if (peekRef.current) {
        gsap.fromTo(
          peekRef.current,
          { scale: 0.86, autoAlpha: 0 },
          { scale: 0.93, autoAlpha: 1, duration: 0.45, ease: "power3.out" },
        );
      }

      const drag = Draggable.create(card, {
        type: "x",
        dragResistance: 0.06,
        cursor: "grab",
        activeCursor: "grabbing",
        onDrag() {
          gsap.set(card, { rotation: this.x / 18 });
        },
        onDragEnd() {
          if (this.x <= -THRESHOLD && canNext) go(1);
          else if (this.x >= THRESHOLD && canPrev) go(-1);
          else snapBack(card);
        },
        onClick() {
          if (current) router.push(`/shifts/${current.id}`);
        },
      })[0];

      return () => drag.kill();
    },
    { scope, dependencies: [index, canNext, canPrev, hasMore, isFetching] },
  );

  if (!current) return null;

  return (
    <div ref={scope} className="flex min-h-0 flex-1 flex-col">
      {/* Card stack */}
      <div className="relative min-h-0 flex-1">
        {peek ? (
          <div ref={peekRef} className="absolute inset-0 z-0">
            <SwipeCard shift={peek} />
          </div>
        ) : null}
        <div ref={topRef} className="absolute inset-0 z-10 touch-pan-y will-change-transform">
          <SwipeCard shift={current} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 pt-4">
        <NavButton
          dir="prev"
          disabled={!canPrev}
          onClick={() => go(-1)}
          label="Previous shift"
        />
        <p className="min-w-16 text-center text-[13px] font-semibold text-text-tertiary">
          {index + 1} / {total}
          {hasMore ? "+" : ""}
        </p>
        <NavButton dir="next" disabled={!canNext} onClick={() => go(1)} label="Next shift" />
      </div>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[12px] text-text-tertiary">
        <Hand size={13} /> Swipe or tap arrows · tap card for details
      </p>
    </div>
  );
}

function NavButton({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm transition active:scale-90 disabled:opacity-35 disabled:active:scale-100"
    >
      <Icon size={22} />
    </button>
  );
}
