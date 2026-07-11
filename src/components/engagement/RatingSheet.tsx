"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useSubmitRatingMutation } from "@/store/api/engagementApi";

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * The rated trust metrics. Same three for both directions; the API keys them as
 * `punctuality_score` / `behavior_score` / `skill_score`. The overall score is
 * the average of these — it isn't rated directly.
 */
const METRICS = [
  { key: "punctuality_score", label: "Punctuality", hint: "On time & dependable" },
  { key: "behavior_score", label: "Behavior", hint: "Professional & respectful" },
  { key: "skill_score", label: "Skill", hint: "Quality of the work" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];
type Scores = Record<MetricKey, number>;

const ZERO: Scores = { punctuality_score: 0, behavior_score: 0, skill_score: 0 };

/**
 * Post-shift rating sheet, shared by both parties. Unlocks once the assignment's
 * completion handshake is confirmed/resolved; one rating per direction per shift
 * (the backend enforces uniqueness and surfaces its message on error). The
 * overall score is the average of the three trust metrics — computed, not tapped.
 */
export default function RatingSheet({
  open,
  assignmentId,
  ratee,
  onClose,
  onDone,
}: {
  open: boolean;
  assignmentId: string;
  /** Who's being rated, e.g. "Sky Lounge" or "Rahim Hossain". */
  ratee?: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [submitRating, { isLoading }] = useSubmitRatingMutation();
  const [scores, setScores] = useState<Scores>(ZERO);
  const [review, setReview] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the sheet (re)opens or targets a new assignment.
  const [prevKey, setPrevKey] = useState(`${assignmentId}:${open}`);
  const key = `${assignmentId}:${open}`;
  if (key !== prevKey) {
    setPrevKey(key);
    if (open) {
      setScores(ZERO);
      setReview("");
      setAnonymous(false);
      setError(null);
    }
  }

  const rated = METRICS.filter((m) => scores[m.key] > 0);
  const overallExact = rated.length
    ? rated.reduce((sum, m) => sum + scores[m.key], 0) / rated.length
    : 0;
  const overall = Math.round(overallExact);
  const complete = rated.length === METRICS.length;

  const setScore = (key: MetricKey, value: number) =>
    setScores((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError(null);
    if (!complete) {
      setError("Rate all three to submit.");
      return;
    }
    try {
      await submitRating({
        assignment_id: assignmentId,
        overall_score: overall,
        punctuality_score: scores.punctuality_score,
        behavior_score: scores.behavior_score,
        skill_score: scores.skill_score,
        review: review.trim() || undefined,
        is_anonymous: anonymous,
      }).unwrap();
      onDone("Thanks — your rating is in.");
    } catch (err) {
      setError(errMessage(err, "Couldn't submit the rating. Try again."));
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} locked={isLoading} className="max-h-[88vh] overflow-y-auto">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/25 text-ink">
        <Star size={22} />
      </span>
      <h2 className="text-[18px] font-bold text-ink">Rate {ratee ?? "your experience"}</h2>
      <p className="mt-1 text-[13px] text-text-secondary">Your feedback shapes reliability scores.</p>

      {/* Computed overall */}
      <div className="mt-5 flex items-center justify-between rounded-2xl bg-brand-light/60 px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">Overall</p>
          <p className="text-[11px] text-text-tertiary">Average of the three below</p>
        </div>
        <div className="flex items-center gap-2">
          <StarRow value={overall} readOnly />
          <span className="w-8 text-right text-[15px] font-bold text-ink">
            {overallExact ? overallExact.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 rounded-2xl border border-border bg-surface px-4 py-3.5">
        {METRICS.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{m.label}</p>
              <p className="text-[11px] text-text-tertiary">{m.hint}</p>
            </div>
            <StarRow value={scores[m.key]} onChange={(v) => setScore(m.key, v)} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-[13px] font-semibold text-ink">
          Review <span className="font-normal text-text-tertiary">(optional)</span>
        </label>
        <textarea
          rows={3}
          maxLength={1000}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share a few words about how it went."
          className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-ink"
        />
      </div>

      <label className="mt-3 flex items-center gap-2.5 text-[13px] text-text-secondary">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-4 w-4 accent-ink"
        />
        Post anonymously
      </label>

      {error ? <p className="mt-3 text-[13px] font-medium text-danger">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button type="button" fullWidth loading={isLoading} disabled={!complete} onClick={submit}>
          <Star size={18} /> Submit rating
        </Button>
        <Button type="button" variant="ghost" fullWidth disabled={isLoading} onClick={onClose}>
          Maybe later
        </Button>
      </div>
    </BottomSheet>
  );
}

/** Tappable (or read-only) 1–5 star row. */
function StarRow({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const size = readOnly ? 20 : 26;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const cls = filled ? "fill-brand text-brand" : "text-black/15";
        if (readOnly) return <Star key={n} size={size} className={cls} strokeWidth={1.5} />;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="active:scale-90"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <Star size={size} className={cls} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
