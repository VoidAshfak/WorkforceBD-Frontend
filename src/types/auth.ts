import type { Role } from "@/lib/validation/auth";

export type { Role };

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type OnboardingStep =
  | "basic"
  | "skills"
  | "availability"
  | "documents"
  | "create_business"
  | null;

export type ProfileSummary = {
  exists: boolean;
  verification_status: VerificationStatus;
  profile_completion: number;
  next_step: OnboardingStep;
};

export type AuthUser = {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
  is_phone_verified: boolean;
};

/** Shape returned by the BFF to the client — never includes raw tokens. */
export type SessionPayload = {
  user: AuthUser;
  active_role: Role | null;
  profile: ProfileSummary | null;
};
