"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { Role } from "@/lib/validation/auth";

const ROLE_LABEL: Record<Role, string> = {
  worker: "Worker Account",
  business: "Business Account",
};

/** Back arrow + role chip, shared by the phone and OTP screens. */
export default function AuthHeader({ role }: { role: Role }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 pt-8">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Go back"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink transition-colors hover:bg-black/5"
      >
        <ArrowLeft size={18} />
      </button>
      <span className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-ink">
          {role[0].toUpperCase()}
        </span>
        <span className="text-[15px] font-medium text-text-secondary">{ROLE_LABEL[role]}</span>
      </span>
    </div>
  );
}
