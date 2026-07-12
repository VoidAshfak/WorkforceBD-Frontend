import { z } from "zod";

/** Step 1 — username + password (see api-guidelines → POST /auth/admin/login). */
export const adminLoginSchema = z.object({
  username: z.string().trim().min(3, "Username is too short").max(50, "Username is too long"),
  password: z.string().min(8, "Password is too short").max(128, "Password is too long"),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** Step 2 — the 6-digit code mailed to the admin's registered address. */
export const adminVerifySchema = z.object({
  username: z.string().trim().min(3).max(50),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type AdminVerifyInput = z.infer<typeof adminVerifySchema>;

/* ----------------------------- Review actions ---------------------------- */

const note = z.string().trim().max(500, "Keep the note under 500 characters");

/** Approve/reject a worker or business KYC profile. */
export const verificationDecisionSchema = z
  .object({
    type: z.enum(["worker", "business"]),
    decision: z.enum(["approve", "reject"]),
    note: note.optional(),
  })
  .refine((v) => v.decision !== "reject" || (v.note?.length ?? 0) > 0, {
    message: "A note is required when rejecting",
    path: ["note"],
  });

/** Approve/reject a shift post awaiting moderation. */
export const shiftDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: note.optional(),
  })
  .refine((v) => v.decision !== "reject" || (v.note?.length ?? 0) > 0, {
    message: "A note is required when rejecting",
    path: ["note"],
  });

/** Rule on a dispute. `pay_partial` must carry an amount (bounds checked server-side). */
export const disputeRulingSchema = z
  .object({
    decision: z.enum(["pay_full", "pay_partial", "deny"]),
    amount: z.number().positive().optional(),
    resolution_note: z
      .string()
      .trim()
      .min(1, "Explain the ruling — both parties see it")
      .max(2000, "Keep the note under 2000 characters"),
  })
  .refine((v) => v.decision !== "pay_partial" || v.amount !== undefined, {
    message: "A partial ruling needs an amount",
    path: ["amount"],
  });

/** Mark a payout sent, or reject it (which refunds the held amount). */
export const payoutDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    failure_reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision !== "reject" || (v.failure_reason?.length ?? 0) > 0, {
    message: "A reason is required when rejecting",
    path: ["failure_reason"],
  });

export const blockUserSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason").max(500, "Keep the reason under 500 characters"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const unblockUserSchema = z.object({
  note: note.optional(),
});

/** Override a runtime platform constant. Range is enforced by the backend. */
export const settingUpdateSchema = z.object({
  value: z.number({ message: "Enter a number" }),
});
