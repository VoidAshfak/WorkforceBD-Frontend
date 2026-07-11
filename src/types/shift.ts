/** Shift discovery shapes (see /docs/api-guidelines.md → Shifts). */

export type ShiftType = "instant" | "scheduled" | "prebooked";

/** Discovery filters accepted by `GET /shifts`. */
export type ShiftFilter = "all" | "nearby" | "urgent" | "high_pay";

/** WGS84 point decoded from the backend's PostGIS geography. */
export type Coordinates = { latitude: number; longitude: number; accuracy?: number };

export type ShiftBusiness = {
  id: string;
  business_name: string;
  logo_url: string | null;
  /** Present on detail responses. */
  reliability_score?: string;
  verification_status?: string;
  /** Operating location; present on detail, `null` when unset. */
  coordinates?: Coordinates | null;
};

export type NamedRef = { id: string; name: string };

/** A shift as it appears in the discovery feed (`GET /shifts`). */
export type Shift = {
  id: string;
  title: string;
  description: string | null;
  role_type: string | null;
  shift_type: ShiftType;
  shift_date: string;
  start_time: string;
  end_time: string;
  pay_amount: string;
  currency: string;
  workers_needed: number;
  meal_included: boolean;
  transport_support: boolean;
  address: string | null;
  landmark: string | null;
  /** Shift location (WGS84); `null` when no location is set. */
  coordinates: Coordinates | null;
  zone_id: string | null;
  status: string;
  business_profiles: ShiftBusiness;
  categories: NamedRef | null;
  zones: NamedRef | null;
  /** Computed slot counters. */
  filled: number;
  capacity: number;
  is_full: boolean;
  /** The requesting worker's own application on this shift. */
  has_applied: boolean;
  /** `{ id, status }` when the worker has applied (any lifecycle state), else null. */
  my_application: { id: string; status: ApplicationStatus } | null;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

/** Home-screen counters (`GET /shifts/dashboard`). */
export type ShiftDashboard = {
  shifts_today: number;
  nearby: number;
  urgent: number;
};

/** Worker application lifecycle (see /docs/api-guidelines.md → Applications). */
export type ApplicationStatus =
  | "pending"
  | "shortlisted"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "no_show";

/** Trimmed shift snapshot embedded in an application row. */
export type ApplicationShift = {
  id: string;
  title: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  pay_amount: string;
  status: string;
  business_profiles: { business_name: string; logo_url: string | null };
  zones: { name: string } | null;
};

/** Presence-proof method for shift check-in. `manual` is business/admin-only. */
export type CheckInMethod = "gps" | "qr";

/**
 * Worker-facing blended state for the activity card — folds application status,
 * shift status, and the completion handshake into one value (`GET /applications`).
 */
export type ActivityStatus =
  | "pending"
  | "shortlisted"
  | "upcoming"
  | "in_progress"
  | "awaiting_confirmation"
  | "confirm_needed"
  | "disputed"
  | "no_show"
  | "completed"
  | "not_selected"
  | "withdrawn"
  | "cancelled";

/** The single next action the worker can take, if any. */
export type NextAction = "check_in" | "check_out" | "confirm_checkout" | "raise_dispute" | null;

/**
 * Two-sided completion handshake on a roster assignment (see
 * /docs/api-guidelines.md → Completion handshake). Payment moves per worker the
 * moment their handshake reaches `confirmed`/`resolved`.
 */
export type CompletionStatus =
  | "pending"
  | "worker_done"
  | "business_done"
  | "confirmed"
  | "resolved"
  | "no_show"
  | "disputed";

/** One node in a shift's status journey. */
export type RoadmapStep = { key: string; label: string; reached: boolean; current: boolean };

/** Shift status journey bar (`roadmap` on applications + business shift detail). */
export type Roadmap = {
  current: string;
  is_cancelled: boolean;
  is_draft: boolean;
  steps: RoadmapStep[];
};

/** A worker's application as it appears in the tracker (`GET /applications`). */
export type Application = {
  id: string;
  status: ApplicationStatus;
  note: string | null;
  applied_at: string;
  shifts: ApplicationShift;
  /** Attendance stamps — only present once the worker checks in/out. */
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  /** Enriched activity-card fields (see /docs/api-guidelines.md → GET /applications). */
  activity_status?: ActivityStatus;
  message?: string | null;
  next_action?: NextAction;
  roadmap?: Roadmap;
  /** Roster assignment fields — feed disputes/ratings and the handshake UI. */
  assignment_id?: string | null;
  completion_status?: CompletionStatus | null;
  /** Handshake auto-confirms (worker paid) at this instant if nobody acts. */
  auto_confirm_at?: string | null;
  paid_amount?: string | null;
  paid_at?: string | null;
};

/** `POST /applications/:id/check-out` — opens the business's confirm window. */
export type CheckOutResult = {
  id: string;
  checked_out_at: string;
  completion_status: CompletionStatus;
  auto_confirm_at: string | null;
};

/** `POST /applications/:id/confirm-checkout` — worker accepts a business-stamped check-out; pays immediately. */
export type ConfirmCheckoutResult = {
  id: string;
  completion_status: CompletionStatus;
  paid_amount: string;
  paid_at: string;
  payment_status: string;
};

/** Activity-tab header counts (`GET /applications/summary`). */
export type ActivitySummary = {
  applications: {
    total: number;
    active: number;
    by_status: Partial<Record<ApplicationStatus, number>>;
  };
  unread_notifications: number;
};
