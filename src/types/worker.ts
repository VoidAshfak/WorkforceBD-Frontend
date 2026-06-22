/** Shared worker-domain shapes used across the BFF, store, and UI. */

/**
 * A selectable reference item from a backend catalog (skill or zone).
 * Optional fields mirror the API: skills include `categoryId`; zones include
 * `cityId` and the city `name` (from the nested `cities` object).
 */
export type CatalogItem = {
  id: string;
  name: string;
  categoryId?: string;
  cityId?: string;
  city?: string;
};

/** Skills + zones the worker can choose from during onboarding. */
export type WorkerCatalog = {
  skills: CatalogItem[];
  zones: CatalogItem[];
};

/**
 * Full worker profile from `GET /worker/profile`. The account-level
 * `full_name` on the auth user is always null — the name a worker sets during
 * onboarding lives here, so the profile screen reads it from this shape.
 */
export type WorkerProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  profile_picture: string | null;
  verification_status: string;
  reliability_score: number | string;
};

/** Cloudinary upload purposes accepted by `/upload/presign`. */
export type PresignPurpose =
  | "profile_picture"
  | "nid_front"
  | "nid_back"
  | "selfie"
  | "student_id";

/** Signed upload credential returned by the BFF presign route. */
export type PresignData = {
  upload_url: string;
  api_key: string;
  cloud_name: string;
  signature: string;
  timestamp: number;
  public_id: string;
  folder: string;
  allowed_formats: string[];
  transformation?: unknown[];
};
