"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Minus, Plus, ShieldCheck, Wallet } from "lucide-react";

import Button from "@/components/ui/Button";
import { useAppSelector } from "@/store/hooks";
import {
  useCreateShiftMutation,
  useGetBusinessWalletQuery,
  useGetCategoriesQuery,
} from "@/store/api/businessApi";
import {
  createShiftSchema,
  type CreateShiftFormInput,
  type CreateShiftInput,
} from "@/lib/validation/business";
import { formatTaka } from "@/lib/format";
import { createLogger } from "@/lib/logger";

const log = createLogger("shift:create");

const SHIFT_TYPES = [
  { value: "instant", label: "Instant", hint: "Needed now" },
  { value: "scheduled", label: "Scheduled", hint: "A set date" },
  { value: "prebooked", label: "Pre-booked", hint: "Plan ahead" },
] as const;

const GENDERS = [
  { value: "prefer_not_to_say", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

/**
 * Create-shift route. Gates on the business verification state — posting a shift
 * requires an admin-verified profile (the backend returns `403` otherwise), so
 * unverified/no-profile businesses get a clear nudge instead of the form.
 */
export default function CreateShiftPage() {
  const router = useRouter();
  const profile = useAppSelector((s) => s.auth.profile);

  if (!profile?.exists) {
    return (
      <Gate
        title="Set up your business first"
        body="Create your business profile to start posting shifts."
        cta="Set up profile"
        onCta={() => router.replace("/onboarding/business")}
        onBack={() => router.back()}
      />
    );
  }
  if (profile.verification_status !== "verified") {
    const pending = profile.verification_status === "pending";
    return (
      <Gate
        title={pending ? "Verification under review" : "Get verified to post shifts"}
        body={
          pending
            ? "An admin is reviewing your documents. You can post shifts once approved."
            : "Posting shifts needs an admin-verified business. Submit your documents to get verified."
        }
        cta={pending ? "Back to home" : "Submit documents"}
        onCta={() => router.replace(pending ? "/" : "/onboarding/business")}
        onBack={() => router.back()}
      />
    );
  }

  return <CreateShiftForm />;
}

/**
 * Create-shift form (business). A single scrollable form — title, category,
 * timing, pay, and headcount — posted to the BFF. Submitting sends it for admin
 * review and escrows the cost (`pay × workers`); "Save draft" holds nothing.
 * The shift inherits the business profile's zone/address (not asked here).
 */
function CreateShiftForm() {
  const router = useRouter();
  const categories = useGetCategoriesQuery();
  const wallet = useGetBusinessWalletQuery();
  const [createShift, { isLoading, error }] = useCreateShiftMutation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateShiftFormInput, unknown, CreateShiftInput>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      title: "",
      category_id: "",
      shift_type: "scheduled",
      shift_date: "",
      start_time: "",
      end_time: "",
      role_type: "",
      description: "",
      gender_preference: "prefer_not_to_say",
      meal_included: false,
      transport_support: false,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const [payRaw, workersRaw] = useWatch({ control, name: ["pay_amount", "workers_needed"] });
  const escrow = (Number(payRaw) || 0) * (Number(workersRaw) || 0);
  const balance = Number(wallet.data?.balance ?? 0);
  const underfunded = escrow > 0 && escrow > balance;

  const apiMessage = useMemo(() => {
    if (!error) return null;
    return (error as { data?: { message?: string } })?.data?.message ?? "Couldn't create the shift. Try again.";
  }, [error]);

  const submit = (draft: boolean) =>
    handleSubmit(async (values) => {
      try {
        const shift = await createShift({ ...values, draft }).unwrap();
        log.info("shift created", { id: shift.id, draft });
        router.replace(`/shifts/${shift.id}`);
      } catch (err) {
        log.warn("create failed", { draft, status: (err as { status?: number })?.status });
        // Error surfaces via `apiMessage`; keep the user on the form to fix/retry.
      }
    });

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-5 pb-3 pt-5 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-ink">Create a shift</h1>
      </header>

      <form className="flex-1 px-5 pb-44 pt-2">
        {/* Title */}
        <Field label="Shift title" error={errors.title?.message}>
          <input
            {...register("title")}
            placeholder="e.g. Banquet Waiters for Wedding"
            maxLength={200}
            autoFocus
            className={inputCls}
          />
        </Field>

        {/* Category */}
        <Field label="Category" error={errors.category_id?.message}>
          {categories.isLoading ? (
            <Loading />
          ) : (
            <select {...register("category_id")} className={`${inputCls} appearance-none`} defaultValue="">
              <option value="" disabled>
                Choose a category
              </option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        {/* Shift type */}
        <Field label="Shift type" error={errors.shift_type?.message}>
          <Controller
            control={control}
            name="shift_type"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2.5">
                {SHIFT_TYPES.map((t) => (
                  <ChoiceCard
                    key={t.value}
                    label={t.label}
                    hint={t.hint}
                    selected={field.value === t.value}
                    onClick={() => field.onChange(t.value)}
                  />
                ))}
              </div>
            )}
          />
        </Field>

        {/* Date */}
        <Field label="Date" error={errors.shift_date?.message}>
          <input type="date" min={today} {...register("shift_date")} className={inputCls} />
        </Field>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" error={errors.start_time?.message}>
            <input type="time" {...register("start_time")} className={inputCls} />
          </Field>
          <Field label="End time" error={errors.end_time?.message}>
            <input type="time" {...register("end_time")} className={inputCls} />
          </Field>
        </div>

        {/* Pay + headcount */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pay / worker (৳)" error={errors.pay_amount?.message}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="1200"
              {...register("pay_amount")}
              className={inputCls}
            />
          </Field>
          <Field label="Workers needed" error={errors.workers_needed?.message}>
            <Controller
              control={control}
              name="workers_needed"
              render={({ field }) => (
                <Stepper value={Number(field.value) || 0} onChange={field.onChange} />
              )}
            />
          </Field>
        </div>

        {/* Role type (optional) */}
        <Field label="Role" optional error={errors.role_type?.message}>
          <input {...register("role_type")} placeholder="e.g. Waiter" maxLength={100} className={inputCls} />
        </Field>

        {/* Gender preference */}
        <Field label="Worker preference" optional>
          <Controller
            control={control}
            name="gender_preference"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2.5">
                {GENDERS.map((g) => (
                  <ChoiceCard
                    key={g.value}
                    label={g.label}
                    selected={field.value === g.value}
                    onClick={() => field.onChange(g.value)}
                  />
                ))}
              </div>
            )}
          />
        </Field>

        {/* Perks */}
        <Field label="Perks" optional>
          <div className="space-y-2.5">
            <Controller
              control={control}
              name="meal_included"
              render={({ field }) => (
                <Toggle label="🍽️ Meal included" checked={!!field.value} onChange={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="transport_support"
              render={({ field }) => (
                <Toggle label="🚌 Transport support" checked={!!field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </Field>

        {/* Description (optional) */}
        <Field label="Details" optional error={errors.description?.message}>
          <textarea
            {...register("description")}
            placeholder="What should workers know? Dress code, duties, arrival notes…"
            rows={3}
            maxLength={2000}
            className={`${inputCls} h-auto resize-none py-3`}
          />
        </Field>

        {apiMessage ? (
          <p className="mt-4 rounded-xl bg-danger/10 p-3 text-[13px] font-medium text-danger">{apiMessage}</p>
        ) : null}
      </form>

      {/* Sticky footer: escrow summary + actions */}
      <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-border bg-surface px-5 pb-6 pt-3">
        {escrow > 0 ? (
          <div className="mb-3 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Wallet size={14} /> Escrow on submit
            </span>
            <span className={`font-bold ${underfunded ? "text-danger" : "text-ink"}`}>
              {formatTaka(escrow)}
              {underfunded ? <span className="ml-1 font-normal">· top up needed</span> : null}
            </span>
          </div>
        ) : null}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={submit(true)}
            disabled={isLoading}
            className="flex-1"
          >
            Save draft
          </Button>
          <Button
            type="button"
            onClick={submit(false)}
            loading={isLoading}
            className="flex-[1.6]"
          >
            Submit for review
          </Button>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------- Pieces --------------------------------- */

function Gate({
  title,
  body,
  cta,
  onCta,
  onBack,
}: {
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 px-5 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-ink">Create a shift</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand">
          <ShieldCheck size={28} className="text-ink" strokeWidth={2.2} />
        </span>
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <p className="max-w-xs text-[15px] leading-6 text-text-secondary">{body}</p>
        <Button onClick={onCta} className="mt-2 px-8">
          {cta}
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky";

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-2">
      <label className="mb-1.5 block text-[14px] font-semibold text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-text-tertiary">· optional</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-[12px] font-medium text-danger">{error}</p> : null}
    </div>
  );
}

function ChoiceCard({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-2 py-2.5 text-center transition-colors active:scale-95 ${
        selected ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink"
      }`}
    >
      <span className="block text-[13px] font-semibold">{label}</span>
      {hint ? (
        <span className={`block text-[10px] ${selected ? "text-white/70" : "text-text-tertiary"}`}>
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const set = (n: number) => onChange(Math.max(1, n));
  return (
    <div className="flex h-12 items-center justify-between rounded-xl border border-border bg-surface px-2">
      <StepBtn aria="Decrease" onClick={() => set(value - 1)} disabled={value <= 1}>
        <Minus size={16} />
      </StepBtn>
      <span className="text-[16px] font-bold text-ink">{value || 1}</span>
      <StepBtn aria="Increase" onClick={() => set((value || 0) + 1)}>
        <Plus size={16} />
      </StepBtn>
    </div>
  );
}

function StepBtn({
  children,
  onClick,
  disabled,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.06] text-ink active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 active:scale-[0.99]"
    >
      <span className="text-[14px] font-medium text-ink">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-emerald" : "bg-black/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Loading() {
  return (
    <div className="flex h-12 items-center gap-2 px-1 text-text-tertiary">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-[13px]">Loading…</span>
    </div>
  );
}
