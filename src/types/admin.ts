/**
 * Admin dashboard shapes (see /docs/api-guidelines.md → Admin, plus the admin
 * slices of Payments and Disputes). Money fields arrive as decimal strings.
 */

import type { Pagination } from "@/types/shift";
import type { VerificationStatus } from "@/types/auth";

/* --------------------------------- Auth ---------------------------------- */

/** `POST /auth/admin/login` — step 1: no tokens yet, just the mailed-code hint. */
export type AdminLoginChallenge = {
  two_factor_required: boolean;
  /** Masked address the code went to, e.g. `to***@gmail.com`. */
  email_hint: string;
  expires_in_minutes: number;
};

/** The signed-in admin. Tokens stay server-side — they never reach this object. */
export type AdminUser = {
  id: string;
  phone: string;
  email: string | null;
  username?: string | null;
  roles: string[];
};

/* ------------------------------- Dashboard -------------------------------- */

export type AdminDashboard = {
  users: { total: number; workers: number; businesses: number; blocked: number };
  pending_review: {
    worker_verifications: number;
    business_verifications: number;
    shift_posts: number;
    open_disputes: number;
    handshakes_awaiting_confirm: number;
  };
  shifts: { total: number; open: number; live: number };
  money: {
    escrow_held: string;
    platform_fee_collected: string;
    worker_earnings_total: string;
  };
};

/** One zero-filled calendar day from `GET /admin/analytics`. */
export type AnalyticsPoint = {
  date: string;
  signups: number;
  shifts_created: number;
  payouts_count: number;
  payouts_amount: number;
  fee_count: number;
  fee_amount: number;
  disputes_raised: number;
};

export type AdminAnalytics = {
  days: number;
  since: string;
  series: AnalyticsPoint[];
};

/* ----------------------------- Verifications ------------------------------ */

export type ProfileType = "worker" | "business";

/**
 * A queue item. Worker rows carry the NID/selfie fields; business rows carry the
 * trade-license ones — the union keeps both optional rather than splitting the
 * queue into two near-identical types.
 */
export type VerificationItem = {
  id: string;
  user_id: string;
  verification_status: VerificationStatus;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
  users?: { phone: string; roles: string[] } | null;

  /** Worker rows */
  full_name?: string | null;
  nid_front_url?: string | null;
  nid_back_url?: string | null;
  selfie_url?: string | null;
  student_id_url?: string | null;

  /** Business rows */
  business_name?: string | null;
  business_type?: string | null;
  trade_license_url?: string | null;
  business_doc_url?: string | null;
};

export type VerificationQueue = { items: VerificationItem[]; pagination: Pagination };

/* --------------------------- Shift moderation ----------------------------- */

export type ModerationShift = {
  id: string;
  title: string;
  status: string;
  shift_date: string;
  pay_amount: string;
  workers_needed: number;
  created_at: string;
  updated_at: string;
  business_profiles: {
    id: string;
    user_id: string;
    business_name: string;
    verification_status: VerificationStatus;
  } | null;
  categories: { id: string; name: string } | null;
  zones: { id: string; name: string } | null;
};

export type ShiftQueue = { items: ModerationShift[]; pagination: Pagination };

/* --------------------------------- Users ---------------------------------- */

export type AdminUserRow = {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
  created_at: string;
  worker_profiles?: {
    id: string;
    full_name: string | null;
    verification_status: VerificationStatus;
    reliability_score: string | null;
  } | null;
  business_profiles?: {
    id: string;
    business_name: string | null;
    verification_status: VerificationStatus;
  } | null;
};

export type AdminUserList = { items: AdminUserRow[]; pagination: Pagination };

export type Sanction = {
  id: string;
  sanction_type: string;
  reason: string;
  severity: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  worker_profiles?:
    | (NonNullable<AdminUserRow["worker_profiles"]> & {
        completed_shift_count?: number;
        no_show_count?: number;
      })
    | null;
  wallets?: { balance: string; total_earned: string } | null;
  sanctions: Sanction[];
};

/* ------------------------------- Payouts ---------------------------------- */

export type AdminPayout = {
  id: string;
  amount: string;
  method: string;
  /** Shown in full on the admin queue — needed to actually disburse. */
  account_number: string;
  account_name: string;
  status: "pending" | "sent" | "failed";
  created_at: string;
  users_payout_requests_user_idTousers?: { id: string; phone: string } | null;
};

export type AdminPayoutQueue = { items: AdminPayout[]; pagination: Pagination };

/* ------------------------------- Disputes --------------------------------- */

export type AdminDispute = {
  id: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  description: string;
  created_at: string;
  decision?: string | null;
  resolved_amount?: string | null;
  resolution_note?: string | null;
  shifts?: { id: string; title: string; pay_amount: string } | null;
  worker_assignments?: {
    id: string;
    completion_status?: string;
    checked_in_at?: string | null;
    checked_out_at?: string | null;
  } | null;
  worker?: { full_name?: string | null; phone?: string | null } | null;
  business?: { business_name?: string | null; phone?: string | null } | null;
};

export type AdminDisputeQueue = { items: AdminDispute[]; pagination: Pagination };

/* ------------------------------- Settings --------------------------------- */

/** A runtime-tunable platform constant. `is_overridden: false` → compiled default. */
export type PlatformSetting = {
  key: string;
  value: number;
  default: number;
  is_overridden: boolean;
  min: number;
  max: number;
  description: string;
  updated_at: string | null;
  updated_by: string | null;
};
