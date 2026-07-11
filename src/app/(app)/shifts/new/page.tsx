"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, useWatch, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, Loader2, Minus, Plus, ShieldCheck, Users, Wallet, X } from "lucide-react";

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

// MapLibre is browser-only — the location picker must not server-render.
const ShiftLocationPicker = dynamic(() => import("@/components/business/ShiftLocationPicker"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-card bg-black/[0.05]" />,
});

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

/** Common languages a customer-facing shift might ask for (multi-select). */
const LANGUAGES = ["Bangla", "English", "Hindi", "Arabic", "Chinese"] as const;

/** Backend charges a 10% platform fee on total worker pay (fee capture deferred). */
const PLATFORM_FEE_RATE = 0.1;
/** `workers_needed` above this is flagged `is_large_request` by the backend. */
const LARGE_REQUEST_THRESHOLD = 20;

/**
 * Wizard steps. `fields` are the ones validated (via RHF `trigger`) before the
 * step can advance; the empty last step is the review + submit screen.
 */
const STEPS = [
  { title: "Basics", fields: ["title", "category_id", "shift_type"] },
  { title: "Schedule", fields: ["shift_date", "start_time", "end_time"] },
  { title: "Location", fields: ["latitude", "longitude"] },
  { title: "Pay & headcount", fields: ["pay_amount", "workers_needed"] },
  { title: "Preferences", fields: ["role_type", "languages"] },
  { title: "Instructions", fields: ["reporting_details", "dress_code", "manager_contact", "description"] },
  { title: "Review", fields: [] },
] as const satisfies ReadonlyArray<{ title: string; fields: readonly (keyof CreateShiftFormInput)[] }>;

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
 * review and escrows the full cost (`pay × workers × 1.10`); "Save draft" holds nothing.
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
    trigger,
    setValue,
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
      uniform_provided: false,
      tips_expected: false,
      experience_required: false,
      customer_facing: false,
      languages: [],
      reporting_details: "",
      dress_code: "",
      manager_contact: "",
      is_urgent: false,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const values = useWatch({ control });
  const pay = Number(values.pay_amount) || 0;
  const workers = Number(values.workers_needed) || 0;

  // Client-side mirror of the backend `cost_breakdown`. The full cost — worker
  // pay + the 10% platform fee (`total_cost`) — is escrowed on submit; the fee is
  // later captured per slot at payout, proportional to what's actually paid.
  const totalWorkerPay = pay * workers;
  const platformFee = Math.round(totalWorkerPay * PLATFORM_FEE_RATE);
  const totalCost = totalWorkerPay + platformFee;
  const largeRequest = workers > LARGE_REQUEST_THRESHOLD;

  const balance = Number(wallet.data?.balance ?? 0);
  const underfunded = totalCost > 0 && totalCost > balance;

  const categoryName = categories.data?.find((c) => c.id === values.category_id)?.name;

  // A near-duplicate (same category + date + start time) returns 409; we then
  // offer a one-tap "Post anyway" that resubmits with `allow_duplicate: true`.
  const [dupPrompt, setDupPrompt] = useState(false);

  // Step-by-step wizard. Each step validates only its own fields before
  // advancing (RHF `trigger`); the last step is the review + submit.
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const next = async () => {
    const fields = STEPS[step].fields;
    const ok = fields.length === 0 || (await trigger([...fields]));
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setDupPrompt(false);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const apiMessage = useMemo(() => {
    if (!error) return null;
    return (error as { data?: { message?: string } })?.data?.message ?? "Couldn't create the shift. Try again.";
  }, [error]);

  const run = async (formValues: CreateShiftInput, draft: boolean, allowDuplicate: boolean) => {
    setDupPrompt(false);
    try {
      const shift = await createShift({
        ...formValues,
        draft,
        allow_duplicate: allowDuplicate || undefined,
      }).unwrap();
      log.info("shift created", { id: shift.id, draft });
      router.replace(`/shifts/${shift.id}`);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409 && !draft) {
        setDupPrompt(true);
        return;
      }
      log.warn("create failed", { draft, status });
      // Other errors surface via `apiMessage`; keep the user on the form to retry.
    }
  };

  const submit = (draft: boolean) => handleSubmit((v) => run(v, draft, false));
  const submitAnyway = handleSubmit((v) => run(v, false, true));

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/95 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-ink">{STEPS[step].title}</h1>
            <p className="text-[12px] text-text-tertiary">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-black/10"}`}
            />
          ))}
        </div>
      </header>

      <form className="flex-1 px-5 pb-28 pt-4">
        {step === 0 ? (
          <div className="space-y-5">
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

        {/* Urgent / emergency staffing */}
        <div>
          <Controller
            control={control}
            name="is_urgent"
            render={({ field }) => (
              <Toggle label="🚨 Urgent — emergency staffing" checked={!!field.value} onChange={field.onChange} />
            )}
          />
        </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
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
          </div>
        ) : null}

        {step === 2 ? (
          <Field label="Shift location" optional error={errors.latitude?.message}>
            <ShiftLocationPicker
              value={
                values.latitude != null && values.longitude != null
                  ? { lat: values.latitude, lng: values.longitude }
                  : null
              }
              onChange={(v) => {
                setValue("latitude", v?.lat, { shouldValidate: true });
                setValue("longitude", v?.lng, { shouldValidate: true });
              }}
            />
          </Field>
        ) : null}

        {step === 3 ? (
          <div>
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
        {largeRequest ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-brand-light/60 p-2.5 text-[12px] text-text-muted">
            <Users size={14} className="mt-0.5 shrink-0" />
            Large request ({workers} workers) — expect it to take longer to fully staff.
          </p>
        ) : null}
        {totalWorkerPay > 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <Wallet size={14} /> Escrow on submit
              </span>
              <span className={`font-bold ${underfunded ? "text-danger" : "text-ink"}`}>
                {formatTaka(totalCost)}
              </span>
            </div>
            {underfunded ? (
              <p className="mt-1 text-[11px] text-danger">
                Wallet balance {formatTaka(balance)} — top up needed before submitting.
              </p>
            ) : null}
          </div>
        ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
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

        {/* Benefits */}
        <Field label="Benefits" optional>
          <div className="space-y-2.5">
            <ToggleField control={control} name="meal_included" label="🍽️ Meal included" />
            <ToggleField control={control} name="transport_support" label="🚌 Transport support" />
            <ToggleField control={control} name="uniform_provided" label="👕 Uniform provided" />
            <ToggleField control={control} name="tips_expected" label="💵 Tips expected" />
          </div>
        </Field>

        {/* Requirements */}
        <Field label="Requirements" optional>
          <div className="space-y-2.5">
            <ToggleField control={control} name="experience_required" label="🎯 Experience required" />
            <ToggleField control={control} name="customer_facing" label="🙋 Customer-facing role" />
          </div>
        </Field>

        {/* Languages */}
        <Field label="Languages" optional error={errors.languages?.message}>
          <Controller
            control={control}
            name="languages"
            render={({ field }) => {
              const selected = field.value ?? [];
              const toggle = (lang: string) =>
                field.onChange(
                  selected.includes(lang)
                    ? selected.filter((l) => l !== lang)
                    : [...selected, lang],
                );
              return (
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <Chip key={lang} label={lang} selected={selected.includes(lang)} onClick={() => toggle(lang)} />
                  ))}
                </div>
              );
            }}
          />
        </Field>

          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-5">
        {/* On-site instructions */}
        <Field label="Reporting details" optional error={errors.reporting_details?.message}>
          <textarea
            {...register("reporting_details")}
            placeholder="Where to report, who to ask for, gate/entrance…"
            rows={2}
            maxLength={1000}
            className={`${inputCls} h-auto resize-none py-3`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dress code" optional error={errors.dress_code?.message}>
            <input {...register("dress_code")} placeholder="e.g. Black formals" maxLength={500} className={inputCls} />
          </Field>
          <Field label="Manager contact" optional error={errors.manager_contact?.message}>
            <input
              {...register("manager_contact")}
              placeholder="On-site phone"
              inputMode="tel"
              maxLength={20}
              className={inputCls}
            />
          </Field>
        </div>

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
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-[15px] font-bold text-ink">{values.title || "Untitled shift"}</p>
              <div className="mt-2 space-y-1">
                <ReviewLine label="Category" value={categoryName ?? "—"} />
                <ReviewLine
                  label="When"
                  value={
                    values.shift_date
                      ? `${values.shift_date} · ${values.start_time}–${values.end_time}`
                      : "—"
                  }
                />
                <ReviewLine label="Workers" value={String(workers)} />
                <ReviewLine label="Pay / worker" value={formatTaka(pay)} />
                <ReviewLine
                  label="Location"
                  value={
                    values.latitude != null && values.longitude != null
                      ? `📍 ${values.latitude.toFixed(4)}, ${values.longitude.toFixed(4)}`
                      : "Business address"
                  }
                />
                {values.is_urgent ? <ReviewLine label="Priority" value="🚨 Urgent" /> : null}
              </div>
            </div>

            {/* Cost breakdown */}
            <div className="space-y-1 rounded-card border border-border bg-surface p-4 text-[13px]">
              <CostLine label="Total worker pay" value={totalWorkerPay} />
              <CostLine label="Platform fee (10%)" value={platformFee} muted />
              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="font-semibold text-ink">Total cost</span>
                <span className="font-bold text-ink">{formatTaka(totalCost)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Wallet size={13} /> Escrowed on submit
                </span>
                <span className={`font-semibold ${underfunded ? "text-danger" : "text-ink"}`}>
                  {formatTaka(totalCost)}
                  {underfunded ? <span className="ml-1 font-normal">· top up needed</span> : null}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">
                Held in escrow now; unused amounts return to your wallet at settlement.
              </p>
            </div>

            {apiMessage && !dupPrompt ? (
              <p className="rounded-xl bg-danger/10 p-3 text-[13px] font-medium text-danger">{apiMessage}</p>
            ) : null}
          </div>
        ) : null}
      </form>

      {/* Sticky footer: step navigation / final actions */}
      <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-border bg-surface px-5 pb-6 pt-3">
        {isLast && dupPrompt ? (
          <div className="mb-3 rounded-xl bg-warning/15 p-3">
            <p className="flex items-start gap-2 text-[13px] font-medium text-text-muted">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              You already have a similar shift (same category, date &amp; start time).
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setDupPrompt(false)}
                className="flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] text-[13px] font-semibold text-ink active:scale-95"
              >
                <X size={14} /> Cancel
              </button>
              <button
                type="button"
                onClick={submitAnyway}
                disabled={isLoading}
                className="flex h-9 flex-[1.4] items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Post anyway
              </button>
            </div>
          </div>
        ) : null}

        {isLast ? (
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
        ) : (
          <Button type="button" onClick={next} className="w-full">
            Continue
          </Button>
        )}
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
    <div>
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

/** Boolean toggle bound to a form field (thin Controller wrapper). */
type BoolField =
  | "meal_included"
  | "transport_support"
  | "uniform_provided"
  | "tips_expected"
  | "experience_required"
  | "customer_facing";

function ToggleField({
  control,
  name,
  label,
}: {
  control: Control<CreateShiftFormInput>;
  name: BoolField;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Toggle label={label} checked={!!field.value} onChange={field.onChange} />
      )}
    />
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors active:scale-95 ${
        selected ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function CostLine({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-text-tertiary" : "text-text-secondary"}>{label}</span>
      <span className={muted ? "text-text-secondary" : "font-semibold text-ink"}>{formatTaka(value)}</span>
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span className="truncate text-right font-medium text-ink">{value}</span>
    </div>
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
