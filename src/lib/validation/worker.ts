import { z } from "zod";

/**
 * Worker onboarding validation (see /docs/api-guidelines.md → Worker Profile).
 * One schema per onboarding step. Skill/zone IDs come from the backend catalog,
 * so the client only checks selection counts, not UUID format — the API is the
 * source of truth for valid IDs.
 */

export const genderSchema = z.enum(["male", "female", "other", "prefer_not_to_say"]);
export const availabilityDaySchema = z.enum(["weekdays", "weekends"]);
export const availabilitySlotSchema = z.enum(["morning", "evening", "night"]);

/** Step 1 — personal info + preferred work zones. */
export const basicInfoSchema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name").max(100, "That name is too long"),
  gender: genderSchema.optional(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick your date of birth")
    .optional(),
  zone_ids: z.array(z.string()).default([]),
});

/** Step 2 — at least one skill is required by the backend. */
export const skillsSchema = z.object({
  skill_ids: z.array(z.string()).min(1, "Pick at least one thing you're great at"),
});

/** Step 3 — availability schedule (+ optional zone refinement). */
export const availabilitySchema = z.object({
  availability_days: z.array(availabilityDaySchema).min(1, "Choose when you can work"),
  availability_slots: z.array(availabilitySlotSchema).min(1, "Pick at least one time slot"),
  zone_ids: z.array(z.string()).optional(),
});

/** Step 4 — KYC document URLs (uploaded to Cloudinary first). */
export const documentsSchema = z.object({
  nid_front_url: z.string().url(),
  nid_back_url: z.string().url(),
  selfie_url: z.string().url(),
  student_id_url: z.string().url().optional(),
});

export type Gender = z.infer<typeof genderSchema>;
export type AvailabilityDay = z.infer<typeof availabilityDaySchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type SkillsInput = z.infer<typeof skillsSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type DocumentsInput = z.infer<typeof documentsSchema>;
