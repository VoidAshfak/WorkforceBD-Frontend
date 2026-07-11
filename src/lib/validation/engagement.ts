import { z } from "zod";

/**
 * `POST /disputes` — raise a dispute on an assignment the caller is a party to.
 * Freezes the handshake until an admin rules.
 */
export const disputeSchema = z.object({
  assignment_id: z.uuid("Invalid assignment"),
  description: z
    .string()
    .trim()
    .min(10, "Describe what went wrong (at least 10 characters)")
    .max(2000, "Keep it under 2000 characters"),
});

export type DisputeInput = z.infer<typeof disputeSchema>;

const score = z.number().int().min(1).max(5);

/** `POST /ratings` — one rating per direction per shift, 1–5 stars. */
export const ratingSchema = z.object({
  assignment_id: z.uuid("Invalid assignment"),
  overall_score: score,
  punctuality_score: score.optional(),
  behavior_score: score.optional(),
  skill_score: score.optional(),
  review: z.string().trim().max(1000, "Keep the review under 1000 characters").optional(),
  is_anonymous: z.boolean().optional(),
});

export type RatingInput = z.infer<typeof ratingSchema>;
