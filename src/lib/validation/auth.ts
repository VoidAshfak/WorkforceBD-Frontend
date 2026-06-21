import { z } from "zod";

/** BD mobile number, canonical format `+8801XXXXXXXXX` (matches API guidelines). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+8801[3-9]\d{8}$/, "Enter a valid BD number (+8801XXXXXXXXX)");

export const roleSchema = z.enum(["worker", "business"]);

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const loginSchema = z.object({
  role: roleSchema,
  phone: phoneSchema,
});

export const verifySchema = z.object({
  phone: phoneSchema,
  otp_code: otpSchema,
  role: roleSchema,
});

export type Role = z.infer<typeof roleSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;

/**
 * Normalize loose user input toward `+8801...`.
 * Accepts `01XXXXXXXXX`, `8801XXXXXXXXX`, `+8801XXXXXXXXX`, with spaces/dashes.
 */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s-]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (p.startsWith("01")) p = `+88${p}`;
  else if (p.startsWith("880")) p = `+${p}`;
  else if (p.startsWith("8801")) p = `+${p}`;
  return p;
}
