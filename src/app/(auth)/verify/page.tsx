"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import AuthHeader from "@/components/auth/AuthHeader";
import OtpInput from "@/components/auth/OtpInput";
import Button from "@/components/ui/Button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearPending } from "@/store/slices/authSlice";
import { useSendOtpMutation, useVerifyOtpMutation } from "@/store/api/authApi";
import { createLogger } from "@/lib/logger";
import { otpSchema } from "@/lib/validation/auth";

const log = createLogger("auth:verify");
const RESEND_SECONDS = 60;

/**
 * OTP verification screen (auth flow screen 3). Reads the pending login intent
 * from Redux, verifies the code, and routes into the app shell. Auto-submits
 * once six digits are entered; offers resend after a countdown.
 */
export default function VerifyPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.auth.pending);

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const [verifyOtp, { isLoading }] = useVerifyOtpMutation();
  const [sendOtp, { isLoading: resending }] = useSendOtpMutation();

  // No pending login intent → user landed here directly; send them back.
  useEffect(() => {
    if (!pending) router.replace("/welcome");
  }, [pending, router]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  if (!pending) return null;

  const submit = async (code: string) => {
    setError(null);
    const valid = otpSchema.safeParse(code);
    if (!valid.success) {
      setError("Enter the 6-digit code");
      return;
    }

    try {
      const session = await verifyOtp({
        phone: pending.phone,
        otp_code: code,
        role: pending.role,
      }).unwrap();

      dispatch(clearPending());

      // Route by onboarding state: a worker with an unfinished profile goes
      // straight into the wizard; everyone else lands in the app shell.
      log.info("verified", { role: session.active_role, next: session.profile?.next_step });
      const needsOnboarding =
        session.active_role === "worker" &&
        session.profile?.verification_status !== "verified" &&
        Boolean(session.profile?.next_step);
      router.replace(needsOnboarding ? "/onboarding/worker" : "/");
    } catch (err) {
      setOtp("");
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Invalid or expired OTP";
      log.warn("verify failed", { message });
      setError(message);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await sendOtp({ phone: pending.phone }).unwrap();
      setOtp("");
      setSeconds(RESEND_SECONDS);
    } catch {
      setError("Could not resend. Try again.");
    }
  };

  const masked = pending.phone.replace("+880", "+880 ");

  return (
    <div className="flex flex-1 flex-col pb-10">
      <AuthHeader role={pending.role} />

      <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand">
        <ShieldCheck size={24} className="text-ink" />
      </span>

      <h1 className="mt-6 text-3xl font-bold text-ink">Enter OTP</h1>
      <p className="mt-2 text-[15px] text-text-secondary">
        Sent to <span className="font-semibold text-ink">{masked}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(otp);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <OtpInput
          value={otp}
          onChange={(v) => {
            setOtp(v);
            setError(null);
            if (v.length === 6) submit(v);
          }}
          disabled={isLoading}
          error={Boolean(error)}
        />
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <Button type="submit" fullWidth loading={isLoading} className="mt-2">
          Verify &amp; Continue
        </Button>
      </form>

      <div className="mt-6 text-center text-[14px] text-text-secondary">
        {seconds > 0 ? (
          <span>
            Resend OTP in <span className="font-semibold text-ink">{seconds}s</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="font-semibold text-emerald disabled:opacity-50"
          >
            Resend OTP
          </button>
        )}
      </div>
    </div>
  );
}
