/** Shift discovery shapes (see /docs/api-guidelines.md → Shifts). */

export type ShiftType = "instant" | "scheduled" | "prebooked";

/** Discovery filters accepted by `GET /shifts`. */
export type ShiftFilter = "all" | "nearby" | "urgent" | "high_pay";

/** WGS84 point decoded from the backend's PostGIS geography. */
export type Coordinates = { latitude: number; longitude: number };

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
