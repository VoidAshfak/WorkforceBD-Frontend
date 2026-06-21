"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";

import AuthHeader from "@/components/auth/AuthHeader";
import Button from "@/components/ui/Button";
import { useAppDispatch } from "@/store/hooks";
import { setPending } from "@/store/slices/authSlice";
import { useSendOtpMutation } from "@/store/api/authApi";
import { createLogger } from "@/lib/logger";
import { normalizePhone, phoneSchema, roleSchema, type Role } from "@/lib/validation/auth";

const log = createLogger("auth:login");

/**
 * Phone-entry screen (auth flow screen 2). Validates the BD number, requests an
 * OTP via the BFF, stores the login intent, then advances to `/verify`.
 */
function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const params = useSearchParams();

  const roleParse = roleSchema.safeParse(params.get("role"));
  const role: Role = roleParse.success ? roleParse.data : "worker";

  const [local, setLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendOtp, { isLoading }] = useSendOtpMutation();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phone = normalizePhone(`0${local.replace(/^0+/, "")}`);
    const valid = phoneSchema.safeParse(phone);
    if (!valid.success) {
      setError(valid.error.issues[0]?.message ?? "Enter a valid number");
      return;
    }

    try {
      const res = await sendOtp({ phone }).unwrap();
      void res;
      dispatch(setPending({ phone, role }));
      router.push("/verify");
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Could not send OTP. Try again.";
      log.warn("send otp failed", { message });
      setError(message);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-10">
      <AuthHeader role={role} />

      <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand">
        <Phone size={24} className="text-ink" />
      </span>

      <h1 className="mt-6 text-3xl font-bold text-ink">Enter your number</h1>
      <p className="mt-2 text-[15px] text-text-secondary">
        We&apos;ll send a 6-digit OTP to verify your identity
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">
          Mobile number
        </label>
        <div
          className={`flex items-center gap-2 rounded-xl border bg-surface px-4 ${
            error ? "border-danger" : "border-border focus-within:border-sky"
          }`}
        >
          <span className="flex items-center gap-1 border-r border-border py-3 pr-3 text-[15px] font-semibold text-ink">
            🇧🇩 +880
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            value={local}
            onChange={(e) => {
              setLocal(e.target.value.replace(/\D/g, "").slice(0, 11));
              setError(null);
            }}
            placeholder="1XXXXXXXXX"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-text-tertiary"
          />
        </div>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <Button type="submit" fullWidth loading={isLoading} className="mt-4">
          Send OTP
        </Button>
      </form>

      <p className="mt-auto pt-8 text-center text-[13px] text-text-tertiary">
        Bangladesh phone numbers only (+880)
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
