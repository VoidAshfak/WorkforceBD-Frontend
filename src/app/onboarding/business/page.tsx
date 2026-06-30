"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PartyPopper, Store } from "lucide-react";

import Button from "@/components/ui/Button";
import StepProgress from "@/components/onboarding/StepProgress";
import SelectableCard from "@/components/onboarding/SelectableCard";
import ProfilePictureField from "@/components/onboarding/ProfilePictureField";
import UploadTile from "@/components/onboarding/UploadTile";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { authApi } from "@/store/api/authApi";
import {
  useCreateBusinessProfileMutation,
  useGetBusinessProfileQuery,
  useSaveBusinessDocumentsMutation,
  useSaveBusinessLocationMutation,
  useSaveBusinessPreferencesMutation,
} from "@/store/api/businessApi";
import { BUSINESS_PERK_OPTIONS, BUSINESS_TYPE_OPTIONS } from "@/config/onboarding";
import { businessProfileSchema } from "@/lib/validation/business";
import { normalizePhone, phoneSchema } from "@/lib/validation/auth";
import { createLogger } from "@/lib/logger";
import type { BusinessProfile } from "@/types/business";

const log = createLogger("onboarding:business");

const STEP_LABELS = ["Business", "Location", "Perks", "Verify"];
const TOTAL = STEP_LABELS.length;

type Perks = {
  meal_included: boolean;
  transport_support: boolean;
  female_friendly: boolean;
  uniform_required: boolean;
};

/**
 * Business profile creation — a four-step onboarding wizard
 * (business basics → location → perks → verification documents). Step 1 creates
 * the profile; the rest are idempotent PATCHes. Submitting documents moves the
 * profile to `pending` review — required before impactful actions (posting
 * shifts, topping up, deciding applicants), but skippable here so a business can
 * finish setup and verify later.
 *
 * The page guards the route and, when resuming an existing profile, waits for it
 * to load before mounting {@link Wizard} so its fields can seed from the data.
 */
export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { activeRole, profile } = useAppSelector((s) => s.auth);
  const hasProfile = profile?.exists ?? false;

  // Resume support: prefill from the existing profile (skip the call otherwise).
  const existing = useGetBusinessProfileQuery(undefined, { skip: !hasProfile });

  // Only a business-context account belongs here.
  useEffect(() => {
    if (activeRole && activeRole !== "business") router.replace("/");
  }, [activeRole, router]);

  // Wait for the resume fetch so the wizard can seed its initial field values.
  if (hasProfile && existing.isLoading) return <Splash />;

  return <Wizard initial={existing.data} hasProfile={hasProfile} />;
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" />
    </div>
  );
}

/* ------------------------------- Wizard --------------------------------- */

function Wizard({ initial, hasProfile }: { initial?: BusinessProfile; hasProfile: boolean }) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [createProfile, createState] = useCreateBusinessProfileMutation();
  const [saveLocation, locationState] = useSaveBusinessLocationMutation();
  const [savePreferences, prefState] = useSaveBusinessPreferencesMutation();
  const [saveDocuments, docState] = useSaveBusinessDocumentsMutation();

  const [step, setStep] = useState(() => (hasProfile ? 1 : 0));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state, seeded from an existing profile when resuming.
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logo_url ?? null);
  const [businessName, setBusinessName] = useState(initial?.business_name ?? "");
  const [businessType, setBusinessType] = useState<string | null>(initial?.business_type ?? null);
  const [managerName, setManagerName] = useState(initial?.manager_name ?? "");
  const [managerPhone, setManagerPhone] = useState(initial?.manager_phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [landmark, setLandmark] = useState(initial?.landmark ?? "");
  const [perks, setPerks] = useState<Perks>({
    meal_included: initial?.meal_included ?? false,
    transport_support: initial?.transport_support ?? false,
    female_friendly: initial?.female_friendly ?? false,
    uniform_required: initial?.uniform_required ?? false,
  });
  const [tradeLicense, setTradeLicense] = useState<string | null>(null);
  const [businessDoc, setBusinessDoc] = useState<string | null>(null);

  const saving =
    createState.isLoading ||
    locationState.isLoading ||
    prefState.isLoading ||
    docState.isLoading;

  const canContinue = useMemo(() => {
    if (step === 0) return businessProfileSchema.shape.business_name.safeParse(businessName).success;
    return true; // steps 1 & 2 are optional
  }, [step, businessName]);

  const back = () => {
    setError(null);
    if (step === 0 || (hasProfile && step === 1)) router.replace("/");
    else setStep((s) => s - 1);
  };

  const next = async () => {
    setError(null);
    try {
      if (step === 0) {
        const phone = managerPhone.trim() ? normalizePhone(managerPhone) : undefined;
        if (phone && !phoneSchema.safeParse(phone).success) {
          setError("Enter a valid BD number (+8801XXXXXXXXX) or leave it blank.");
          return;
        }
        await createProfile({
          business_name: businessName.trim(),
          business_type: businessType ?? undefined,
          manager_name: managerName.trim() || undefined,
          manager_phone: phone,
          logo_url: logoUrl ?? undefined,
        }).unwrap();
        setStep(1);
      } else if (step === 1) {
        await saveLocation({
          address: address.trim() || undefined,
          landmark: landmark.trim() || undefined,
        }).unwrap();
        setStep(2);
      } else if (step === 2) {
        await savePreferences(perks).unwrap();
        setStep(3);
      } else if (step === 3) {
        // Documents are optional here; only submit when at least one was added.
        if (tradeLicense || businessDoc) {
          await saveDocuments({
            trade_license_url: tradeLicense ?? undefined,
            business_doc_url: businessDoc ?? undefined,
          }).unwrap();
        }
        log.info("business onboarding complete", { docsSubmitted: Boolean(tradeLicense || businessDoc) });
        setSubmitted(true);
      }
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Something went wrong. Try again.";
      log.warn("step save failed", { step, message });
      setError(message);
    }
  };

  const skip = () => {
    setError(null);
    if (step < TOTAL - 1) setStep((s) => s + 1);
    else setSubmitted(true);
  };

  const finish = () => {
    // Refresh the session so the app sees the new business profile.
    dispatch(authApi.util.invalidateTags(["Session"]));
    router.replace("/");
  };

  if (submitted) return <SuccessScreen onDone={finish} />;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 bg-background/95 px-6 pb-3 pt-5 backdrop-blur">
        <button
          type="button"
          onClick={back}
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <StepProgress current={step} total={TOTAL} labels={STEP_LABELS} />
      </header>

      <main className="flex-1 px-6 pb-40 pt-4">
        <div key={step} className="wf-step-enter">
          {step === 0 ? (
            <BusinessStep
              logoUrl={logoUrl}
              setLogoUrl={setLogoUrl}
              businessName={businessName}
              setBusinessName={setBusinessName}
              businessType={businessType}
              setBusinessType={setBusinessType}
              managerName={managerName}
              setManagerName={setManagerName}
              managerPhone={managerPhone}
              setManagerPhone={setManagerPhone}
            />
          ) : null}

          {step === 1 ? (
            <LocationStep
              address={address}
              setAddress={setAddress}
              landmark={landmark}
              setLandmark={setLandmark}
            />
          ) : null}

          {step === 2 ? <PerksStep perks={perks} setPerks={setPerks} /> : null}

          {step === 3 ? (
            <DocumentsStep
              tradeLicense={tradeLicense}
              setTradeLicense={setTradeLicense}
              businessDoc={businessDoc}
              setBusinessDoc={setBusinessDoc}
            />
          ) : null}
        </div>

        {error ? <p className="mt-4 text-[13px] font-medium text-danger">{error}</p> : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background to-transparent px-6 pb-6 pt-4">
        <Button fullWidth onClick={next} loading={saving} disabled={!canContinue}>
          {step === TOTAL - 1 ? "Finish setup" : "Continue"}
        </Button>
        {step > 0 ? (
          <button
            type="button"
            onClick={skip}
            className="mt-3 w-full text-center text-[13px] font-medium text-text-tertiary"
          >
            Skip for now
          </button>
        ) : null}
      </footer>
    </div>
  );
}

/* ------------------------------- Steps ---------------------------------- */

function StepHeading({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="mb-5">
      <span className="text-3xl">{emoji}</span>
      <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-[14px] text-text-secondary">{sub}</p>
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky";

function BusinessStep(props: {
  logoUrl: string | null;
  setLogoUrl: (v: string | null) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  businessType: string | null;
  setBusinessType: (v: string | null) => void;
  managerName: string;
  setManagerName: (v: string) => void;
  managerPhone: string;
  setManagerPhone: (v: string) => void;
}) {
  return (
    <>
      <StepHeading emoji="🏪" title="Tell us about your business" sub="This is what workers see when you post." />

      <p className="mb-1.5 text-[14px] font-semibold text-ink">
        Logo <span className="font-normal text-text-tertiary">· optional</span>
      </p>
      <ProfilePictureField value={props.logoUrl} onChange={props.setLogoUrl} purpose="business_logo" />

      <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">Business name</label>
      <input
        value={props.businessName}
        onChange={(e) => props.setBusinessName(e.target.value)}
        placeholder="e.g. The Wedding Studio"
        autoFocus
        maxLength={200}
        className={inputCls}
      />

      <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">
        Type <span className="font-normal text-text-tertiary">· optional</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {BUSINESS_TYPE_OPTIONS.map((t) => (
          <SelectableCard
            key={t.value}
            emoji={t.emoji}
            label={t.label}
            selected={props.businessType === t.value}
            onToggle={() => props.setBusinessType(props.businessType === t.value ? null : t.value)}
            row
          />
        ))}
      </div>

      <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">
        Contact person <span className="font-normal text-text-tertiary">· optional</span>
      </label>
      <input
        value={props.managerName}
        onChange={(e) => props.setManagerName(e.target.value)}
        placeholder="Manager name"
        maxLength={100}
        className={inputCls}
      />
      <input
        value={props.managerPhone}
        onChange={(e) => props.setManagerPhone(e.target.value)}
        placeholder="+8801XXXXXXXXX"
        inputMode="tel"
        className={`${inputCls} mt-3`}
      />
    </>
  );
}

function LocationStep(props: {
  address: string;
  setAddress: (v: string) => void;
  landmark: string;
  setLandmark: (v: string) => void;
}) {
  return (
    <>
      <StepHeading emoji="📍" title="Where do you operate?" sub="Helps workers know where they'll be heading." />

      <label className="mb-1.5 block text-[14px] font-semibold text-ink">
        Address <span className="font-normal text-text-tertiary">· optional</span>
      </label>
      <input
        value={props.address}
        onChange={(e) => props.setAddress(e.target.value)}
        placeholder="House, road, area"
        autoFocus
        maxLength={300}
        className={inputCls}
      />

      <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">
        Landmark <span className="font-normal text-text-tertiary">· optional</span>
      </label>
      <input
        value={props.landmark}
        onChange={(e) => props.setLandmark(e.target.value)}
        placeholder="e.g. Near Gulshan Club"
        maxLength={200}
        className={inputCls}
      />

      <p className="mt-5 rounded-xl bg-cream p-3 text-[12px] text-text-secondary">
        You set the exact zone and pickup details per shift when you post one.
      </p>
    </>
  );
}

function PerksStep(props: { perks: Perks; setPerks: (v: Perks) => void }) {
  return (
    <>
      <StepHeading emoji="✨" title="What do you offer?" sub="Perks make your shifts more attractive to workers." />
      <div className="grid grid-cols-1 gap-3">
        {BUSINESS_PERK_OPTIONS.map((p) => (
          <SelectableCard
            key={p.key}
            emoji={p.emoji}
            label={p.label}
            hint={p.hint}
            selected={props.perks[p.key]}
            onToggle={() => props.setPerks({ ...props.perks, [p.key]: !props.perks[p.key] })}
            row
          />
        ))}
      </div>
    </>
  );
}

function DocumentsStep(props: {
  tradeLicense: string | null;
  setTradeLicense: (v: string | null) => void;
  businessDoc: string | null;
  setBusinessDoc: (v: string | null) => void;
}) {
  return (
    <>
      <StepHeading
        emoji="🪪"
        title="Get verified"
        sub="Submit a document to unlock posting shifts and hiring. You can also do this later."
      />

      <div className="grid grid-cols-2 gap-4">
        <UploadTile
          label="Trade license"
          hint="Clear and readable"
          emoji="📄"
          purpose="trade_license"
          value={props.tradeLicense}
          onChange={props.setTradeLicense}
        />
        <UploadTile
          label="Business doc"
          hint="Any official document"
          emoji="🏢"
          purpose="business_doc"
          value={props.businessDoc}
          onChange={props.setBusinessDoc}
          optional
        />
      </div>

      <p className="mt-5 rounded-xl bg-cream p-3 text-[12px] text-text-secondary">
        An admin reviews your documents. Until verified you can build your profile and browse, but
        not post shifts or hire.
      </p>
    </>
  );
}

/* ------------------------------ Success --------------------------------- */

function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
      <span className="wf-pop flex h-24 w-24 items-center justify-center rounded-full bg-brand">
        <PartyPopper size={44} className="text-ink" />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-ink">Profile set up! 🎉</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-6 text-text-secondary">
        Your business profile is ready. Once an admin verifies your documents you can post shifts and
        hire — you can submit them anytime from your profile.
      </p>
      <Button fullWidth onClick={onDone} className="mt-8">
        <Store size={18} /> Go to dashboard
      </Button>
    </div>
  );
}
