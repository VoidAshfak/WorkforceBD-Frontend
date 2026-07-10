import { z } from "zod";

/**
 * Worker payout (withdrawal) validation (see /docs/api-guidelines.md →
 * POST /payments/payouts). Mirrors the backend's bounds so the form catches
 * obvious errors before the request; the backend stays the source of truth
 * (balance check, verification gate) and its messages are forwarded as-is.
 */

export const payoutMethodSchema = z.enum(["bkash", "nagad", "bank_transfer"]);

export const payoutSchema = z.object({
  amount: z.coerce.number().min(50, "Minimum payout is ৳50"),
  method: payoutMethodSchema,
  account_number: z
    .string()
    .trim()
    .min(6, "Enter your account number")
    .max(20, "Account number is too long"),
  account_name: z.string().trim().max(100).optional(),
});

/** Validated output (amount coerced to number) — sent to the API. */
export type PayoutInput = z.infer<typeof payoutSchema>;
/** Raw form shape before coercion — used as react-hook-form's field values. */
export type PayoutFormInput = z.input<typeof payoutSchema>;
