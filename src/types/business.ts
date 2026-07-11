/** Business-domain shapes (see /docs/api-guidelines.md → Business, Categories). */

import type { ApplicationStatus, CompletionStatus, Pagination, Roadmap } from "@/types/shift";

/** Shift type a business can post. */
export type ShiftKind = "instant" | "scheduled" | "prebooked";

/** Gender preference a shift can request. */
export type GenderPreference = "male" | "female" | "other" | "prefer_not_to_say";

/** Home dashboard counters (`GET /business/dashboard`). */
export type BusinessDashboard = {
  active_shifts: number;
  total_shifts: number;
  applicants_waiting: number;
  urgent_staffing: number;
  /** Hired ÷ needed across active shifts, as a percent (0–100). */
  fill_rate: number;
};

/** Business wallet snapshot (`GET /business/wallet`). Amounts are decimal strings. */
export type BusinessWallet = {
  id: string;
  balance: string;
  held: string;
  total_spent: string;
  currency: string;
};

/** Full business profile (`GET /business/profile`). Used to resume onboarding. */
export type BusinessProfile = {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string | null;
  logo_url: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  address: string | null;
  landmark: string | null;
  zone_id: string | null;
  verification_status: string;
  meal_included: boolean;
  transport_support: boolean;
  female_friendly: boolean;
  uniform_required: boolean;
  reliability_score: string;
  zones: { id: string; name: string } | null;
};

/**
 * One row of the business wallet ledger (`GET /business/wallet/transactions`).
 * Mirrors the worker ledger but adds `held_after` (escrowed balance after the
 * move). `type`: `credit` = funds in/returned, `debit` = funds held or spent.
 * `shift_id` is `null` for top-ups. Amounts are decimal strings.
 */
export type BusinessWalletTxn = {
  id: string;
  type: "credit" | "debit";
  amount: string;
  balance_after: string;
  held_after: string;
  description: string;
  shift_id: string | null;
  reference_id: string | null;
  created_at: string;
};

export type BusinessWalletTxnList = {
  items: BusinessWalletTxn[];
  pagination: Pagination;
};

/** A shared shift category (`GET /categories`). */
export type Category = {
  id: string;
  name: string;
  icon_url: string | null;
};

/**
 * Compensation breakdown carried on a shift (create response, list, detail).
 * Amounts are decimal strings. `platform_fee` is 10% of `total_worker_pay`;
 * **`total_cost` (pay + fee) is what gets escrowed at submit**. The fee is
 * captured per worker slot at payout, proportional to what was actually paid —
 * no-shows and denied disputes incur no fee.
 */
export type ShiftCostBreakdown = {
  worker_pay: string;
  workers_needed: number;
  total_worker_pay: string;
  platform_fee: string;
  total_cost: string;
};

/**
 * A shift as it appears in the business's own list (`GET /business/shifts`).
 * Carries staffing counters plus the count of applicants awaiting a decision.
 */
export type BusinessShift = {
  id: string;
  title: string;
  role_type: string | null;
  shift_type: ShiftKind;
  shift_date: string;
  start_time: string;
  end_time: string;
  pay_amount: string;
  currency: string;
  workers_needed: number;
  status: string;
  categories: { id: string; name: string } | null;
  zones: { id: string; name: string } | null;
  /** Computed slot counters. */
  filled: number;
  capacity: number;
  is_full: boolean;
  /** `pending` + `shortlisted` applicants on this shift. */
  applicants_waiting: number;
  /** `true` while `draft`/`published`/`applications_open` AND nobody hired yet. */
  is_editable: boolean;
  /** `true` when `workers_needed` exceeds the large-request threshold (20). */
  is_large_request: boolean;
  /** Compensation breakdown for the compensation screen. */
  cost_breakdown: ShiftCostBreakdown;
};

export type BusinessShiftList = {
  items: BusinessShift[];
  pagination: Pagination;
};

/**
 * Single owned-shift detail (`GET /business/shifts/:id`) — the list shape plus
 * the descriptive fields shown on the created-shift page.
 */
export type BusinessShiftDetail = BusinessShift & {
  description: string | null;
  gender_preference: string | null;
  address: string | null;
  landmark: string | null;
  /** Benefits offered to workers. */
  meal_included: boolean;
  transport_support: boolean;
  uniform_provided: boolean;
  tips_expected: boolean;
  /** Requirements asked of applicants. */
  experience_required: boolean;
  customer_facing: boolean;
  languages: string[];
  /** On-site instructions. */
  reporting_details: string | null;
  dress_code: string | null;
  manager_contact: string | null;
  /** Emergency staffing flag. */
  is_urgent: boolean;
  /** Map pin (WGS84), or `null` when the shift has no location set. */
  coordinates: { latitude: number; longitude: number } | null;
  /** Status journey bar (detail only). */
  roadmap: Roadmap | null;
};

/** Worker reputation telemetry shown on an applicant row. */
export type ApplicantWorker = {
  id: string;
  full_name: string | null;
  profile_picture: string | null;
  verification_status: string;
  reliability_score: string;
  attendance_rate: string;
  completion_rate: string;
  no_show_count: number;
  completed_shift_count: number;
};

/** An applicant on an owned shift (`GET /business/shifts/:id/applicants`). */
export type Applicant = {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  note: string | null;
  worker_profiles: ApplicantWorker;
};

export type ApplicantList = {
  items: Applicant[];
  pagination: Pagination;
};

/**
 * Applicant decisions a business can take on a pending/shortlisted applicant.
 * `unshortlist` reverts a shortlisted applicant back to `pending`.
 */
export type ApplicantDecision = "shortlist" | "unshortlist" | "accept" | "reject";

/** Bulk applicant action (`POST /business/shifts/:id/applicants/bulk`). */
export type BulkAction = "shortlist" | "reject";

/** Result of a bulk applicant action. */
export type BulkResult = { action: BulkAction; requested: number; updated: number; skipped: number };

/** Weighted factors that build a cancellation rate (base + capped adjustments). */
export type PenaltyFactors = Record<string, number>;

/** One hired worker's cancellation compensation on the delete preview. */
export type PenaltyWorker = {
  worker_profile_id: string;
  full_name: string | null;
  /** Per-worker rate ∈ [0.10, 0.75] applied to `pay_amount`. */
  rate: number;
  /** Compensation paid to this worker (decimal string). */
  amount: string;
  factors: PenaltyFactors;
};

/** Penalty block of a cancellation preview (`null` on a free delete). */
export type CancellationPenalty = {
  total_penalty: string;
  shift_factors: PenaltyFactors;
  workers: PenaltyWorker[];
};

/** Why a delete is free (`penalty` when money moves). */
export type CancellationReason =
  | "penalty"
  | "no_workers_hired"
  | "shift_expired"
  | "outside_notice_window";

/**
 * Dry-run breakdown for the swipe-to-delete modal
 * (`GET /business/shifts/:id/cancellation-preview`). Moves no money. Amounts are
 * decimal strings. When `free`, `penalty` is `null` and `refund_to_business`
 * equals `escrow_amount`.
 */
export type CancellationPreview = {
  shift_id: string;
  title: string;
  status: string;
  free: boolean;
  penalty_applies: boolean;
  reason: CancellationReason;
  is_expired: boolean;
  hours_to_start: number;
  hired_count: number;
  escrow_amount: string;
  refund_to_business: string;
  penalty: CancellationPenalty | null;
};

/** Body for `DELETE /business/shifts/:id`. */
export type DeleteShiftInput = {
  id: string;
  reason?: string;
  /** Required `true` to execute a penalty delete (backend 409s otherwise). */
  acknowledge_penalty?: boolean;
};

/* ----------------------- Live-attendance roster ------------------------- */

/**
 * Per-worker roster state — blends attendance and the completion handshake
 * (`GET /business/shifts/:id/roster`).
 */
export type RosterWorkerStatus =
  | "waiting"
  | "checked_in"
  | "checked_out"
  | "awaiting_business_confirm"
  | "awaiting_worker_confirm"
  | "paid"
  | "no_show"
  | "disputed";

/** What the business can do on a roster row right now. */
export type RosterNextAction = "confirm_checkout" | "checkout" | "mark_no_show" | null;

/** One hired worker on the live roster. */
export type RosterEntry = {
  assignment_id: string;
  application_id: string;
  worker: {
    id: string;
    full_name: string | null;
    profile_picture: string | null;
    reliability_score: string;
  };
  status: RosterWorkerStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checkin_method: string | null;
  completion_status: CompletionStatus;
  /** Open handshakes auto-confirm (worker paid) at this instant. */
  auto_confirm_at: string | null;
  paid_amount: string | null;
  paid_at: string | null;
  next_action: RosterNextAction;
};

/**
 * Live-attendance roster for an owned shift. `checkin_code` rotates every ~30 s
 * — re-fetch before `checkin_code_expires_in` seconds elapse to keep the QR
 * scannable (the shift secret itself is never returned).
 */
export type ShiftRoster = {
  shift: {
    id: string;
    title: string;
    status: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    workers_needed: number;
  };
  checkin_code: string;
  checkin_code_expires_in: number;
  summary: { needed: number; assigned: number; checked_in: number };
  roster: RosterEntry[];
};

/**
 * Updated assignment returned by the handshake actions
 * (`POST /business/assignments/:id/{checkout,confirm,no-show}`).
 */
export type AssignmentActionResult = {
  id?: string;
  completion_status?: CompletionStatus;
  auto_confirm_at?: string | null;
  paid_amount?: string | null;
  paid_at?: string | null;
};

/** Business handshake actions on a roster assignment (path-whitelisted in the BFF). */
export type AssignmentAction = "checkout" | "confirm" | "no-show";

/** Result of the confirm-everything settle shortcut (`POST /payments/shifts/:id/settle`). */
export type SettleResult = {
  shift_id: string;
  workers_paid: number;
  no_show: number;
  disputes_held: number;
  already_settled: number;
  amount_each: string;
  /** `true` when no disputes remain and the shift finalized (escrow released). */
  closed: boolean;
};
