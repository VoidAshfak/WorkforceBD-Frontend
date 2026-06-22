"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SwipeCard from "@/components/shifts/SwipeCard";
import { Draggable, gsap, useGSAP } from "@/lib/gsap";
import type { Shift } from "@/types/shift";

/** Horizontal drag (px) past which a swipe commits to prev/next. */
const THRESHOLD = 110;

// Resting pose of the next card behind the top one — slightly smaller, nudged
// down, and tilted so its edges fan out like a stack of playing cards.
const PEEK_SCALE = 0.95;
const PEEK_Y = 10;
const PEEK_ROT = -4;

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

  const [index, setIndex] = useState(0);

  const total = items.length;
  const current = items[index];
  const peek = items[index + 1];
  const canNext = Boolean(peek);
  const canPrev = index > 0;

  const snapBack = (card: HTMLElement) =>
    gsap.to(card, { x: 0, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.6)" });

  /** Commit a navigation: fling the top card away, then swap the index. */
  const go = useCallback(
    (dir: 1 | -1) => {
      const card = topRef.current;
      if (!card || animating.current) return;
      if ((dir === 1 && !canNext) || (dir === -1 && !canPrev)) return snapBack(card);

      // Card exits toward the finger: next is a left-drag (exits left), prev a
      // right-drag (exits right) — i.e. opposite the navigation direction.
      const exit = -dir;
      animating.current = true;
      gsap.to(card, {
        x: exit * (window.innerWidth + 120),
        rotation: exit * 14,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          const nextIndex = index + dir;
          animating.current = false;
          setIndex(nextIndex);
          // Prefetch the next page while a couple of cards are still in hand.
          if (dir === 1 && hasMore && !isFetching && nextIndex >= total - 2) onNeedMore();
        },
      });
    },
    [canNext, canPrev, hasMore, isFetching, index, total, onNeedMore],
  );

  // Latest values for the Draggable closure, which is bound only once per
  // `index` (see useGSAP deps). Without these refs the drag handlers would
  // capture stale `go`/`canNext`/`canPrev`, or force the entrance animation to
  // replay every time fetch state flips — the source of the swap flicker.
  const liveRef = useRef({ go, canNext, canPrev, current });
  liveRef.current = { go, canNext, canPrev, current };

  useGSAP(
    () => {
      const card = topRef.current;
      if (!card) return;

      // The incoming top card starts exactly where the peek card was resting
      // (the fanned PEEK pose) and settles forward to square up at the front —
      // so it reads as the behind card sliding into place, not a new card
      // popping in. Continuity with the peek's resting transform keeps the
      // motion a single smooth direction (no bounce). The peek is already
      // mounted (z-0 below), so there is no render gap when it promotes.
      gsap.fromTo(
        card,
        { x: 0, y: PEEK_Y, scale: PEEK_SCALE, rotation: PEEK_ROT, autoAlpha: 1 },
        { y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.42, ease: "power3.out" },
      );
      if (peekRef.current) {
        // Next card fades into its fanned resting pose behind the top one.
        gsap.fromTo(
          peekRef.current,
          { scale: 0.88, y: PEEK_Y, rotation: PEEK_ROT, autoAlpha: 0 },
          { scale: PEEK_SCALE, y: PEEK_Y, rotation: PEEK_ROT, autoAlpha: 1, duration: 0.42, ease: "power3.out" },
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
          const { go, canNext, canPrev } = liveRef.current;
          if (this.x <= -THRESHOLD && canNext) go(1);
          else if (this.x >= THRESHOLD && canPrev) go(-1);
          else snapBack(card);
        },
        onClick() {
          const { current } = liveRef.current;
          if (current) router.push(`/shifts/${current.id}`);
        },
      })[0];

      return () => drag.kill();
    },
    { scope, dependencies: [index] },
  );

  if (!current) return null;

  return (
    <div ref={scope} className="flex min-h-0 flex-1 flex-col">
      {/* Card stack — fills the height; cards fan out behind like playing cards. */}
      <div className="relative min-h-0 flex-1">
        {/* Deepest layer: a static card silhouette tilted the opposite way so
            the pile reads as three stacked cards. Purely decorative. */}
        {peek ? (
          <div
            aria-hidden
            className="absolute inset-0 z-0 origin-center translate-y-2 rotate-[4deg] scale-90 rounded-[32px] border border-border bg-surface shadow-[0_18px_40px_-22px_rgba(0,0,0,0.4)]"
          />
        ) : null}

        {peek ? (
          <div ref={peekRef} className="absolute inset-0 z-[1]">
            <SwipeCard shift={peek} />
          </div>
        ) : null}

        <div ref={topRef} className="absolute inset-0 z-10 touch-pan-y will-change-transform">
          <SwipeCard shift={current} />
        </div>

        {/* Position counter — floats over the hero, between the badges. */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          {index + 1} / {total}
          {hasMore ? "+" : ""}
        </div>
      </div>
    </div>
  );
}
