"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BadgeCheck, Send, XCircle } from "lucide-react";

import SwipeCard from "@/components/shifts/SwipeCard";
import { cardTheme } from "@/config/shiftTheme";
import { useApplyToShiftMutation } from "@/store/api/shiftsApi";
import { Draggable, gsap, useGSAP } from "@/lib/gsap";
import type { Shift } from "@/types/shift";

/** Horizontal drag (px) past which a swipe commits to prev/next. */
const THRESHOLD = 110;
/** Upward drag (px) past which the card is "applied" (folds + flies away). */
const UP_THRESHOLD = 130;

// Resting pose of the next card behind the top one — slightly smaller, nudged
// down, and tilted so its edges fan out like a stack of playing cards.
const PEEK_SCALE = 0.95;
const PEEK_Y = 10;
const PEEK_ROT = -4;

type Toast = { text: string; tone: "success" | "error" | "info" };

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback
  );
}

/**
 * Full-screen swipe deck for shift discovery. Drag (or tap the arrows) left →
 * next, right → previous, and **up → apply** (the card folds like paper and
 * flies off to the business). Tapping a card opens its detail. Pagination is
 * prefetched near the end so the deck feels endless. Motion is GSAP via
 * {@link useGSAP} (auto-cleaned).
 */
export default function SwipeDeck({
  items,
  hasMore,
  isFetching,
  verified,
  onNeedMore,
}: {
  items: Shift[];
  hasMore: boolean;
  isFetching: boolean;
  verified: boolean;
  onNeedMore: () => void;
}) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  // Optimistically-applied shift ids — so a card looped back to shows "Applied"
  // and can't be re-submitted (which the server rejects with 409).
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set());

  const [apply] = useApplyToShiftMutation();

  /** Reflect an optimistic apply on the card without mutating RTK cache. */
  const decorate = useCallback(
    (shift: Shift | undefined): Shift | undefined => {
      if (!shift || shift.has_applied || !appliedIds.has(shift.id)) return shift;
      return { ...shift, has_applied: true, my_application: { id: "optimistic", status: "pending" } };
    },
    [appliedIds],
  );

  const total = items.length;
  const current = decorate(items[index]);
  // Circular deck — neighbours wrap around the ends so the swipe is endless.
  const next = total > 1 ? decorate(items[(index + 1) % total]) : undefined;
  const prev = total > 1 ? decorate(items[(index - 1 + total) % total]) : undefined;
  const canNext = total > 1;
  const canPrev = total > 1;

  const snapBack = (card: HTMLElement) => {
    gsap.to(card, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.6)" });
    gsap.to(hintRef.current, { autoAlpha: 0, duration: 0.2 });
  };

  const showToast = useCallback((text: string, tone: Toast["tone"]) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => void (toastTimer.current && clearTimeout(toastTimer.current)), []);

  /** Commit a navigation: fling the top card away, then swap the index. */
  const go = useCallback(
    (dir: 1 | -1) => {
      const card = topRef.current;
      if (!card || animating.current) return;
      if ((dir === 1 && !canNext) || (dir === -1 && !canPrev)) return snapBack(card);

      gsap.set(nextRef.current, { autoAlpha: dir === 1 ? 1 : 0 });
      gsap.set(prevRef.current, { autoAlpha: dir === -1 ? 1 : 0 });

      const exit = -dir;
      animating.current = true;
      gsap.to(card, {
        x: exit * (window.innerWidth + 120),
        rotation: exit * 14,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
          const rawNext = index + dir;
          animating.current = false;
          setIndex((rawNext + total) % total);
          if (dir === 1 && hasMore && !isFetching && rawNext >= total - 2) onNeedMore();
        },
      });
    },
    [canNext, canPrev, hasMore, isFetching, index, total, onNeedMore],
  );

  /** Advance to the next card after an apply-fly (no extra fling). */
  const advance = useCallback(() => {
    const rawNext = index + 1;
    animating.current = false;
    setIndex((rawNext + total) % total);
    if (hasMore && !isFetching && rawNext >= total - 2) onNeedMore();
  }, [hasMore, index, isFetching, onNeedMore, total]);

  /** Fire the application in the background; report via toast. */
  const doApply = useCallback(
    async (shift: Shift) => {
      try {
        await apply({ shift_id: shift.id }).unwrap();
        showToast("Applied! ✈️", "success");
      } catch (err) {
        // Undo the optimistic mark so the card can be retried.
        setAppliedIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(shift.id);
          return nextSet;
        });
        showToast(errMessage(err, "Couldn't apply. Try again."), "error");
      }
    },
    [apply, showToast],
  );

  /**
   * The signature move: the card folds in on itself (perspective rotateY +
   * scaleX collapse) into a paper-dart shape, a little plane peels off and
   * arcs up toward the business, then the deck advances.
   */
  const applyFly = useCallback(
    (shift: Shift) => {
      const card = topRef.current;
      if (!card || animating.current) return;
      animating.current = true;
      // Mark applied up front so a looped-back card shows the applied state.
      setAppliedIds((prev) => new Set(prev).add(shift.id));
      doApply(shift);

      const dx = -window.innerWidth * 0.4;
      const dy = -window.innerHeight * 0.72;
      const plane = planeRef.current;

      const tl = gsap.timeline({ onComplete: advance });
      gsap.set(hintRef.current, { autoAlpha: 0 });
      // Fold: collapse the card to a thin folded strip.
      tl.set(card, { transformPerspective: 900, transformOrigin: "50% 45%" });
      tl.to(card, { rotationY: 78, scaleX: 0.16, rotation: -5, duration: 0.34, ease: "power2.in" }, 0);
      // The folded card darts up and away to the business.
      tl.to(
        card,
        { x: dx, y: dy, rotation: -42, scale: 0.22, autoAlpha: 0, duration: 0.55, ease: "power2.in" },
        0.32,
      );
      // A little paper plane peels off and follows the same arc.
      if (plane) {
        tl.set(plane, { autoAlpha: 0, x: 0, y: 0, rotation: -18, scale: 0.7 }, 0);
        tl.to(plane, { autoAlpha: 1, scale: 1, duration: 0.18, ease: "back.out(2)" }, 0.16);
        tl.to(plane, { x: dx * 1.05, y: dy, rotation: -52, scale: 0.45, duration: 0.6, ease: "power2.in" }, 0.3);
        tl.to(plane, { autoAlpha: 0, duration: 0.2 }, 0.74);
      }
    },
    [advance, doApply],
  );

  /** Gate the apply on verification / shift state, then fly or bounce + toast. */
  const tryApply = useCallback(() => {
    const card = topRef.current;
    if (!card || !current) return;
    if (!verified) {
      snapBack(card);
      showToast("Get verified to apply", "info");
      return;
    }
    if (current.has_applied) {
      snapBack(card);
      showToast("You've already applied", "info");
      return;
    }
    if (current.is_full) {
      snapBack(card);
      showToast("This shift is full", "info");
      return;
    }
    applyFly(current);
  }, [applyFly, current, showToast, verified]);

  // Latest values for the Draggable closure, bound once per `index`.
  const liveRef = useRef({ go, canNext, canPrev, current, tryApply });
  useEffect(() => {
    liveRef.current = { go, canNext, canPrev, current, tryApply };
  });

  const showBehind = (dir: 1 | -1) => {
    gsap.set(nextRef.current, { autoAlpha: dir === 1 ? 1 : 0 });
    gsap.set(prevRef.current, { autoAlpha: dir === -1 ? 1 : 0 });
  };

  useGSAP(
    () => {
      const card = topRef.current;
      if (!card) return;

      // Incoming top card settles forward from the peek pose; rotationY/scaleX are
      // reset too so a card returning from an apply-fold lands square.
      gsap.fromTo(
        card,
        { x: 0, y: PEEK_Y, scale: PEEK_SCALE, rotation: PEEK_ROT, rotationY: 0, autoAlpha: 1 },
        { y: 0, scale: 1, rotation: 0, rotationY: 0, autoAlpha: 1, duration: 0.42, ease: "power3.out" },
      );

      for (const ref of [nextRef.current, prevRef.current]) {
        if (ref) gsap.set(ref, { scale: PEEK_SCALE, y: PEEK_Y, rotation: PEEK_ROT });
      }
      if (nextRef.current) {
        gsap.fromTo(nextRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.42, ease: "power3.out" });
      }
      if (prevRef.current) gsap.set(prevRef.current, { autoAlpha: 0 });

      const drag = Draggable.create(card, {
        type: "x,y",
        dragResistance: 0.06,
        cursor: "grab",
        activeCursor: "grabbing",
        onDrag() {
          const liftDominant = Math.abs(this.y) > Math.abs(this.x) && this.y < 0;
          if (liftDominant) {
            // Lifting to apply — keep it level, swell the hint, hide the H-peek.
            gsap.set(card, { rotation: this.x / 40 });
            const p = Math.min(1, -this.y / UP_THRESHOLD);
            gsap.set(hintRef.current, { autoAlpha: p, y: -8 * p, scale: 0.9 + 0.1 * p });
            gsap.set([nextRef.current, prevRef.current], { autoAlpha: 0 });
          } else {
            gsap.set(card, { rotation: this.x / 18 });
            gsap.set(hintRef.current, { autoAlpha: 0 });
            if (this.x > 8) showBehind(-1);
            else if (this.x < -8) showBehind(1);
          }
        },
        onDragEnd() {
          const { go, canNext, canPrev, tryApply } = liveRef.current;
          const up = this.y <= -UP_THRESHOLD && Math.abs(this.y) > Math.abs(this.x);
          if (up) {
            tryApply();
            return;
          }
          if (this.x <= -THRESHOLD && canNext) go(1);
          else if (this.x >= THRESHOLD && canPrev) go(-1);
          else {
            snapBack(card);
            showBehind(1);
          }
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

  // Animate the toast in whenever its text changes.
  useGSAP(
    () => {
      if (toast && toastRef.current) {
        gsap.fromTo(
          toastRef.current,
          { y: -20, autoAlpha: 0, scale: 0.9 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" },
        );
      }
    },
    { dependencies: [toast] },
  );

  if (!current) return null;

  return (
    <div ref={scope} className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {/* Theme-matched glow halo behind the deck. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[78%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[64px] transition-colors duration-500"
          style={{ backgroundColor: cardTheme(current.id).glow }}
        />

        {next || prev ? (
          <div
            aria-hidden
            className="absolute inset-0 z-0 origin-center translate-y-2 rotate-[4deg] scale-90 rounded-[32px] border border-border bg-surface shadow-[0_18px_40px_-22px_rgba(0,0,0,0.4)]"
          />
        ) : null}

        {prev ? (
          <div ref={prevRef} className="absolute inset-0 z-[1] opacity-0">
            <SwipeCard shift={prev} />
          </div>
        ) : null}

        {next ? (
          <div ref={nextRef} className="absolute inset-0 z-[1]">
            <SwipeCard shift={next} />
          </div>
        ) : null}

        <div ref={topRef} className="absolute inset-0 z-10 touch-none will-change-transform">
          <SwipeCard shift={current} />
        </div>

        {/* Paper plane that peels off on apply (driven by GSAP). */}
        <div
          ref={planeRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 text-[64px] opacity-0 drop-shadow-lg"
        >
          ✈️
        </div>

        {/* "Release to apply" hint that swells as you lift the card. */}
        <div
          ref={hintRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-emerald px-3.5 py-2 text-[13px] font-bold text-white opacity-0 shadow-lg"
        >
          <Send size={14} /> Release to apply
        </div>

        {/* Position counter. */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          {index + 1} / {total}
          {hasMore ? "+" : ""}
        </div>
      </div>

      {/* Apply toast — portaled to <body> and pinned near the top (where the
          card flew), with a very high z so it sits above every screen chrome. */}
      {toast && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 top-[84px] flex justify-center px-4"
              style={{ zIndex: 2147483647 }}
            >
              <div
                ref={toastRef}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold shadow-xl ${
                  toast.tone === "success"
                    ? "bg-emerald text-white"
                    : toast.tone === "error"
                      ? "bg-danger text-white"
                      : "bg-ink text-white"
                }`}
              >
                {toast.tone === "success" ? (
                  <BadgeCheck size={15} />
                ) : toast.tone === "error" ? (
                  <XCircle size={15} />
                ) : (
                  <Send size={15} />
                )}
                {toast.text}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
