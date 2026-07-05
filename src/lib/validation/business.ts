import { z } from "zod";

import { phoneSchema } from "@/lib/validation/auth";

/**
 * Business shift-creation validation (see /docs/api-guidelines.md →
 * POST /business/shifts). Category/zone IDs come from the backend, so the client
 * only checks presence, not UUID format — the API is the source of truth.
 * `zone_id`/`address`/`landmark` are omitted: the backend defaults them to the
 * business profile's location when absent.
 */

export const shiftKindSchema = z.enum(["instant", "scheduled", "prebooked"]);
export const genderPreferenceSchema = z.enum([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const createShiftSchema = z
  .object({
    title: z.string().trim().min(3, "Give the shift a clear title").max(200, "Title is too long"),
    category_id: z.string().min(1, "Pick a category"),
    shift_type: shiftKindSchema,
    shift_date: z.string().regex(YMD, "Pick a date"),
    start_time: z.string().regex(HHMM, "Set a start time"),
    end_time: z.string().regex(HHMM, "Set an end time"),
    pay_amount: z.coerce.number().positive("Pay must be greater than 0"),
    workers_needed: z.coerce.number().int().min(1, "Need at least one worker"),
    role_type: z.string().trim().max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    gender_preference: genderPreferenceSchema.optional(),
    // Benefits.
    meal_included: z.boolean().default(false),
    transport_support: z.boolean().default(false),
    uniform_provided: z.boolean().default(false),
    tips_expected: z.boolean().default(false),
    // Requirements.
    experience_required: z.boolean().default(false),
    customer_facing: z.boolean().default(false),
    languages: z.array(z.string().trim().min(1).max(50)).max(10, "Up to 10 languages").optional(),
    // On-site instructions.
    reporting_details: z.string().trim().max(1000).optional(),
    dress_code: z.string().trim().max(500).optional(),
    // Defaults to the business profile's manager phone when absent.
    manager_contact: z.string().trim().max(20).optional(),
    // Map pin (WGS84). Must be sent together; absent → backend falls back to the
    // business profile's location.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    // Emergency staffing flag.
    is_urgent: z.boolean().default(false),
    /** `true` bypasses the backend near-duplicate guard (409). */
    allow_duplicate: z.boolean().optional(),
    /** `true` saves as a draft instead of submitting for admin review. */
    draft: z.boolean().optional(),
  })
  .refine((v) => v.shift_date >= new Date().toISOString().slice(0, 10), {
    message: "Shift date cannot be in the past",
    path: ["shift_date"],
  })
  // Mirror the backend's `end_time must be after start_time` (422). Only compare
  // once both are well-formed so the field-level regex errors surface first.
  .refine((v) => !HHMM.test(v.start_time) || !HHMM.test(v.end_time) || v.end_time > v.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  })
  // Coordinates are a pair — the backend rejects one without the other.
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: "Pick a point on the map",
    path: ["latitude"],
  });

/* ----------------------------- Onboarding ------------------------------- */

/**
 * Business onboarding validation (see /docs/api-guidelines.md → Business).
 * Step 1 creates the profile; steps 2–3 are idempotent PATCHes. The verification
 * documents step is intentionally omitted — upload presign has no
 * `trade_license`/`business_doc` purpose yet, and the step is optional.
 */

/** Step 1 — create the business profile (`POST /business/profile`). */
export const businessProfileSchema = z.object({
  business_name: z.string().trim().min(2, "Tell us your business name").max(200, "That name is too long"),
  business_type: z.string().trim().max(100).optional(),
  manager_name: z.string().trim().max(100).optional(),
  // Optional, but if given must be a valid BD number.
  manager_phone: phoneSchema.optional(),
  logo_url: z.string().url().optional(),
});

/**
 * Step 2 — operating location (`PATCH /business/profile/location`). `zone_id` is
 * omitted: there is no business-context zones endpoint to populate a picker, so
 * the profile carries a free-text address/landmark only.
 */
export const businessLocationSchema = z.object({
  address: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(200).optional(),
});

/**
 * Verification documents (`PATCH /business/profile/documents`). At least one of
 * the two URLs is required by the backend; uploaded via presign purposes
 * `trade_license` / `business_doc`. Submitting moves status to `pending`.
 */
export const businessDocumentsSchema = z
  .object({
    trade_license_url: z.string().url().optional(),
    business_doc_url: z.string().url().optional(),
  })
  .refine((v) => Boolean(v.trade_license_url || v.business_doc_url), {
    message: "Add at least one verification document",
    path: ["trade_license_url"],
  });

/** Step 3 — perk/attire toggles shown to workers (`PATCH .../preferences`). */
export const businessPreferencesSchema = z.object({
  meal_included: z.boolean().default(false),
  transport_support: z.boolean().default(false),
  female_friendly: z.boolean().default(false),
  uniform_required: z.boolean().default(false),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type BusinessLocationInput = z.infer<typeof businessLocationSchema>;
export type BusinessDocumentsInput = z.infer<typeof businessDocumentsSchema>;
export type BusinessPreferencesInput = z.infer<typeof businessPreferencesSchema>;

/** Validated output (numbers coerced, defaults applied) — sent to the API. */
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
/** Raw form shape before coercion — used as react-hook-form's field values. */
export type CreateShiftFormInput = z.input<typeof createShiftSchema>;
