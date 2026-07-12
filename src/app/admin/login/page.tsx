"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

import { adminLoginSchema, adminVerifySchema } from "@/lib/validation/admin";
import type { AdminLoginInput, AdminVerifyInput } from "@/lib/validation/admin";
import { useAdminLoginMutation, useAdminVerifyMutation } from "@/store/api/adminApi";
import { Button, Field, inputClass } from "@/components/admin/ui";

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

/** Why the previous session ended — set by the shell when it bounces us here. */
const REASONS: Record<string, string> = {
  expired: "Your session ended. Sign in again.",
  timeout: "Signed out after 10 minutes of inactivity.",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}

function AdminLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const notice = REASONS[params.get("reason") ?? ""] ?? null;

  // Step 1 hands the username to step 2 — the backend needs it alongside the code.
  const [challenge, setChallenge] = useState<{ username: string; emailHint: string } | null>(null);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      {/* Brand wash so the console doesn't read as a bare form. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-ink">
            <ShieldCheck size={24} />
          </span>
          <h1 className="mt-3 text-[21px] font-bold text-white">WorkforceBD Admin</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Authorised personnel only. Every sign-in is recorded.
          </p>
        </div>

        <div className="rounded-card border border-white/10 bg-surface p-6">
          {notice ? (
            <p className="mb-4 rounded-input bg-warning/20 px-3.5 py-2.5 text-[12.5px] font-medium text-text-muted">
              {notice}
            </p>
          ) : null}

          {challenge ? (
            <VerifyStep
              username={challenge.username}
              emailHint={challenge.emailHint}
              onBack={() => setChallenge(null)}
              onDone={() => router.replace("/admin")}
            />
          ) : (
            <CredentialsStep onChallenge={setChallenge} />
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-white/35">
          Sessions end when the browser closes or after 10 minutes idle.
        </p>
      </div>
    </div>
  );
}

/** Step 1 — username + password. On success the backend mails a 6-digit code. */
function CredentialsStep({
  onChallenge,
}: {
  onChallenge: (c: { username: string; emailHint: string }) => void;
}) {
  const [login, { isLoading }] = useAdminLoginMutation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginInput>({ resolver: zodResolver(adminLoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await login(values).unwrap();
      onChallenge({ username: values.username, emailHint: res.email_hint });
    } catch (err) {
      // The backend answers "Invalid credentials" for every failure mode on
      // purpose (no username probing) — pass it through unchanged.
      setError(errMessage(err, "Couldn't sign in. Try again."));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Username">
        <input
          {...register("username")}
          autoComplete="username"
          autoFocus
          className={inputClass}
          placeholder="admin"
        />
        {errors.username ? (
          <span className="mt-1 block text-[12px] text-danger">{errors.username.message}</span>
        ) : null}
      </Field>

      <Field label="Password">
        <input
          {...register("password")}
          type="password"
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••"
        />
        {errors.password ? (
          <span className="mt-1 block text-[12px] text-danger">{errors.password.message}</span>
        ) : null}
      </Field>

      {error ? <p className="text-[12.5px] font-medium text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-pill bg-ink py-3 text-[14px] font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        Continue
      </button>
    </form>
  );
}

/** Step 2 — the mailed code. Only this step issues the session cookies. */
function VerifyStep({
  username,
  emailHint,
  onBack,
  onDone,
}: {
  username: string;
  emailHint: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [verify, { isLoading }] = useAdminVerifyMutation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminVerifyInput>({
    resolver: zodResolver(adminVerifySchema),
    defaultValues: { username },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await verify(values).unwrap();
      onDone();
    } catch (err) {
      setError(errMessage(err, "Couldn't verify the code. Try again."));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" {...register("username")} />

      <div className="flex items-start gap-2.5 rounded-input bg-brand-light/70 px-3.5 py-3">
        <Mail size={16} className="mt-0.5 shrink-0 text-ink" />
        <p className="text-[12.5px] leading-snug text-text-muted">
          A 6-digit code went to <span className="font-bold text-ink">{emailHint}</span>. It expires
          in 5 minutes.
        </p>
      </div>

      <Field label="Verification code">
        <input
          {...register("code")}
          inputMode="numeric"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          className={`${inputClass} text-center text-[22px] font-bold tracking-[0.5em]`}
          placeholder="000000"
        />
        {errors.code ? (
          <span className="mt-1 block text-[12px] text-danger">{errors.code.message}</span>
        ) : null}
      </Field>

      {error ? <p className="text-[12.5px] font-medium text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-pill bg-ink py-3 text-[14px] font-bold text-white transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        Verify & enter
      </button>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> Use a different account
        </Button>
      </div>
    </form>
  );
}
