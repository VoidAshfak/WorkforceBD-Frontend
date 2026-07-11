/**
 * Disputes + ratings shapes (see /docs/api-guidelines.md → Disputes, Ratings).
 * Both modules are party-based: the assignment's worker or the shift's owning
 * business may use them regardless of the active role context.
 */

import type { CompletionStatus, Pagination } from "@/types/shift";

/* -------------------------------- Disputes ------------------------------- */

export type DisputeStatus = "open" | "under_review" | "resolved" | "dismissed";

/** Admin ruling on a resolved dispute. */
export type DisputeDecision = "pay_full" | "pay_partial" | "deny";

/**
 * A dispute as returned by `POST /disputes` / `GET /disputes/my`. Summary
 * relations are typed loosely — the guideline documents them as "shift +
 * assignment + party summaries" without pinning the exact shape.
 */
export type Dispute = {
  id: string;
  status: DisputeStatus;
  description: string;
  created_at: string;
  /** Present once an admin has ruled. */
  decision?: DisputeDecision | null;
  resolved_amount?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  assignment_id?: string | null;
  shifts?: { id: string; title: string; pay_amount?: string } | null;
  worker_assignments?: {
    id: string;
    completion_status?: CompletionStatus;
    checked_in_at?: string | null;
    checked_out_at?: string | null;
  } | null;
  /** Who raised it (`worker` | `business`), when the backend includes it. */
  raised_by?: string | null;
};

export type DisputeList = {
  items: Dispute[];
  pagination: Pagination;
};

/* -------------------------------- Ratings -------------------------------- */

/**
 * A mutual post-shift rating (`POST /ratings`, `GET /ratings/my`). One per
 * direction per shift; unlocks once the handshake is `confirmed`/`resolved`.
 */
export type Rating = {
  id: string;
  overall_score: number;
  punctuality_score: number | null;
  behavior_score: number | null;
  skill_score: number | null;
  review: string | null;
  is_anonymous: boolean;
  created_at: string;
  /** Assignment this rating is tied to (used to hide the "Rate" action once given). */
  assignment_id?: string | null;
  shifts?: { id: string; title: string } | null;
  /** `null` on received items when the rater chose to stay anonymous. */
  rater?: { full_name?: string | null; business_name?: string | null } | null;
  rated?: { full_name?: string | null; business_name?: string | null } | null;
};

/** `GET /ratings/my` — items plus the caller's received summary. */
export type RatingList = {
  items: Rating[];
  summary: { average: number; count: number };
  pagination: Pagination;
};
