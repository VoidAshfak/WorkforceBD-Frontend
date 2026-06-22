"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, PartyPopper, ShieldCheck } from "lucide-react";

import Button from "@/components/ui/Button";
import StepProgress from "@/components/onboarding/StepProgress";
import ProfilePictureField from "@/components/onboarding/ProfilePictureField";
import SelectableCard from "@/components/onboarding/SelectableCard";
import ChipSelect from "@/components/onboarding/ChipSelect";
import UploadTile from "@/components/onboarding/UploadTile";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { authApi } from "@/store/api/authApi";
import {
  useGetCatalogQuery,
  useSaveAvailabilityMutation,
  useSaveBasicMutation,
  useSaveDocumentsMutation,
  useSaveSkillsMutation,
} from "@/store/api/workerApi";
import {
  DAY_OPTIONS,
  GENDER_OPTIONS,
  SLOT_OPTIONS,
  skillEmoji,
} from "@/config/onboarding";
import { createLogger } from "@/lib/logger";
import {
  basicInfoSchema,
  type AvailabilityDay,
  type AvailabilitySlot,
  type Gender,
} from "@/lib/validation/worker";
import type { OnboardingStep } from "@/types/auth";

const log = createLogger("onboarding:worker");

/** Onboarding step order — index aligns with the API's `next_step` values. */
const STEP_KEYS = ["basic", "skills", "availability", "documents"] as const;
const STEP_LABELS = ["You", "Skills", "When", "Verify"];

const stepIndex = (next: OnboardingStep): number => {
  const i = STEP_KEYS.indexOf(next as (typeof STEP_KEYS)[number]);
  return i >= 0 ? i : 0;
};

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Worker profile creation — a four-step, gamified onboarding wizard
 * (basic → skills → availability → documents). Each step saves to the BFF and
 * advances; the final step submits KYC docs and moves verification to `pending`.
 */
export default function WorkerOnboardingPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, activeRole, profile } = useAppSelector((s) => s.auth);

  const { data: catalog, isLoading: catalogLoading } = useGetCatalogQuery();

  const [saveBasic, basicState] = useSaveBasicMutation();
  const [saveSkills, skillsState] = useSaveSkillsMutation();
  const [saveAvailability, availState] = useSaveAvailabilityMutation();
  const [saveDocuments, docsState] = useSaveDocumentsMutation();

  // SessionGate guarantees the session is hydrated before this mounts, so the
  // profile/user are available to seed the wizard's initial state directly.
  const [step, setStep] = useState(() => (profile ? stepIndex(profile.next_step) : 0));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (one slice per step).
  const [fullName, setFullName] = useState(() => user?.full_name ?? "");
  const [gender, setGender] = useState<Gender | undefined>();
  const [dob, setDob] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  // Guard: only workers with an unfinished profile belong here.
  useEffect(() => {
    if (!profile || !activeRole || submitted) return;
    if (activeRole !== "worker") {
      router.replace("/");
      return;
    }
    if (profile.verification_status === "verified" || profile.next_step === null) {
      router.replace("/");
    }
  }, [profile, activeRole, submitted, router]);

  const saving =
    basicState.isLoading ||
    skillsState.isLoading ||
    availState.isLoading ||
    docsState.isLoading;

  // Per-step readiness gates the Continue button (server still re-validates).
  const canContinue = useMemo(() => {
    if (step === 0) return basicInfoSchema.safeParse({ full_name: fullName }).success;
    if (step === 1) return skillIds.length >= 1;
    if (step === 2) return days.length >= 1 && slots.length >= 1;
    if (step === 3) return Boolean(nidFront && nidBack && selfie);
    return false;
  }, [step, fullName, skillIds, days, slots, nidFront, nidBack, selfie]);

  const back = () => {
    setError(null);
    if (step === 0) router.replace("/");
    else setStep((s) => s - 1);
  };

  const next = async () => {
    setError(null);
    try {
      if (step === 0) {
        await saveBasic({
          full_name: fullName.trim(),
          gender,
          date_of_birth: dob || undefined,
          profile_picture: profilePicture ?? undefined,
          zone_ids: zoneIds,
        }).unwrap();
        setStep(1);
      } else if (step === 1) {
        await saveSkills({ skill_ids: skillIds }).unwrap();
        setStep(2);
      } else if (step === 2) {
        await saveAvailability({
          availability_days: days,
          availability_slots: slots,
          zone_ids: zoneIds.length ? zoneIds : undefined,
        }).unwrap();
        setStep(3);
      } else if (step === 3) {
        await saveDocuments({
          nid_front_url: nidFront!,
          nid_back_url: nidBack!,
          selfie_url: selfie!,
          student_id_url: studentId ?? undefined,
        }).unwrap();
        log.info("documents submitted");
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

  const finish = () => {
    // Refresh the session so the app sees the new "pending" status.
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
        <StepProgress current={step} total={STEP_KEYS.length} labels={STEP_LABELS} />
      </header>

      <main className="flex-1 px-6 pb-40 pt-4">
        <div key={step} className="wf-step-enter">
          {step === 0 ? (
            <BasicStep
              fullName={fullName}
              setFullName={setFullName}
              gender={gender}
              setGender={setGender}
              dob={dob}
              setDob={setDob}
              profilePicture={profilePicture}
              setProfilePicture={setProfilePicture}
              zoneIds={zoneIds}
              setZoneIds={setZoneIds}
              zones={catalog?.zones ?? []}
              catalogLoading={catalogLoading}
            />
          ) : null}

          {step === 1 ? (
            <SkillsStep
              skillIds={skillIds}
              setSkillIds={setSkillIds}
              skills={catalog?.skills ?? []}
              catalogLoading={catalogLoading}
            />
          ) : null}

          {step === 2 ? (
            <AvailabilityStep
              days={days}
              setDays={setDays}
              slots={slots}
              setSlots={setSlots}
              zoneIds={zoneIds}
              setZoneIds={setZoneIds}
              zones={catalog?.zones ?? []}
            />
          ) : null}

          {step === 3 ? (
            <DocumentsStep
              nidFront={nidFront}
              setNidFront={setNidFront}
              nidBack={nidBack}
              setNidBack={setNidBack}
              selfie={selfie}
              setSelfie={setSelfie}
              studentId={studentId}
              setStudentId={setStudentId}
            />
          ) : null}
        </div>

        {error ? <p className="mt-4 text-[13px] font-medium text-danger">{error}</p> : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background to-transparent px-6 pb-6 pt-4">
        <Button fullWidth onClick={next} loading={saving} disabled={!canContinue}>
          {step === 3 ? "Submit for review" : "Continue"}
        </Button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => router.replace("/")}
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

function CatalogLoader() {
  return (
    <div className="flex items-center gap-2 py-6 text-text-tertiary">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-[13px]">Loading options…</span>
    </div>
  );
}

function BasicStep(props: {
  fullName: string;
  setFullName: (v: string) => void;
  gender: Gender | undefined;
  setGender: (v: Gender) => void;
  dob: string;
  setDob: (v: string) => void;
  profilePicture: string | null;
  setProfilePicture: (v: string | null) => void;
  zoneIds: string[];
  setZoneIds: (v: string[]) => void;
  zones: { id: string; name: string }[];
  catalogLoading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <StepHeading emoji="👋" title="Let's get to know you" sub="The basics — takes under a minute." />

      <p className="mb-1.5 text-[14px] font-semibold text-ink">
        Profile photo <span className="font-normal text-text-tertiary">· optional</span>
      </p>
      <ProfilePictureField value={props.profilePicture} onChange={props.setProfilePicture} />

      <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">What should we call you?</label>
      <input
        value={props.fullName}
        onChange={(e) => props.setFullName(e.target.value)}
        placeholder="e.g. Rahim Hossain"
        autoFocus
        maxLength={100}
        className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky"
      />

      <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">You are…</p>
      <div className="grid grid-cols-2 gap-3">
        {GENDER_OPTIONS.map((g) => (
          <SelectableCard
            key={g.value}
            emoji={g.emoji}
            label={g.label}
            selected={props.gender === g.value}
            onToggle={() => props.setGender(g.value)}
            row
          />
        ))}
      </div>

      <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">
        Date of birth <span className="font-normal text-text-tertiary">· optional</span>
      </label>
      <input
        type="date"
        value={props.dob}
        max={today}
        onChange={(e) => props.setDob(e.target.value)}
        className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky"
      />

      <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">
        Where do you want to work? <span className="font-normal text-text-tertiary">· optional</span>
      </p>
      {props.catalogLoading ? (
        <CatalogLoader />
      ) : (
        <ChipSelect
          items={props.zones}
          selectedIds={props.zoneIds}
          onToggle={(id) => props.setZoneIds(toggle(props.zoneIds, id))}
        />
      )}
    </>
  );
}

function SkillsStep(props: {
  skillIds: string[];
  setSkillIds: (v: string[]) => void;
  skills: { id: string; name: string }[];
  catalogLoading: boolean;
}) {
  return (
    <>
      <StepHeading emoji="💪" title="What are you great at?" sub="Pick all that apply — at least one." />
      {props.catalogLoading ? (
        <CatalogLoader />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {props.skills.map((s) => (
            <SelectableCard
              key={s.id}
              emoji={skillEmoji(s.name)}
              label={s.name}
              selected={props.skillIds.includes(s.id)}
              onToggle={() => props.setSkillIds(toggle(props.skillIds, s.id))}
            />
          ))}
        </div>
      )}
      {!props.catalogLoading && props.skills.length === 0 ? (
        <p className="text-[13px] text-text-secondary">No skills available right now.</p>
      ) : null}
    </>
  );
}

function AvailabilityStep(props: {
  days: AvailabilityDay[];
  setDays: (v: AvailabilityDay[]) => void;
  slots: AvailabilitySlot[];
  setSlots: (v: AvailabilitySlot[]) => void;
  zoneIds: string[];
  setZoneIds: (v: string[]) => void;
  zones: { id: string; name: string }[];
}) {
  return (
    <>
      <StepHeading emoji="🗓️" title="When can you work?" sub="Tell us your rhythm — change it anytime." />

      <p className="mb-2 text-[14px] font-semibold text-ink">Which days?</p>
      <div className="grid grid-cols-2 gap-3">
        {DAY_OPTIONS.map((d) => (
          <SelectableCard
            key={d.value}
            emoji={d.emoji}
            label={d.label}
            hint={d.hint}
            selected={props.days.includes(d.value)}
            onToggle={() => props.setDays(toggle(props.days, d.value))}
          />
        ))}
      </div>

      <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Which times?</p>
      <div className="grid grid-cols-3 gap-3">
        {SLOT_OPTIONS.map((s) => (
          <SelectableCard
            key={s.value}
            emoji={s.emoji}
            label={s.label}
            hint={s.hint}
            selected={props.slots.includes(s.value)}
            onToggle={() => props.setSlots(toggle(props.slots, s.value))}
          />
        ))}
      </div>

      {props.zones.length ? (
        <>
          <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">
            Refine your zones <span className="font-normal text-text-tertiary">· optional</span>
          </p>
          <ChipSelect
            items={props.zones}
            selectedIds={props.zoneIds}
            onToggle={(id) => props.setZoneIds(toggle(props.zoneIds, id))}
          />
        </>
      ) : null}
    </>
  );
}

function DocumentsStep(props: {
  nidFront: string | null;
  setNidFront: (v: string | null) => void;
  nidBack: string | null;
  setNidBack: (v: string | null) => void;
  selfie: string | null;
  setSelfie: (v: string | null) => void;
  studentId: string | null;
  setStudentId: (v: string | null) => void;
}) {
  return (
    <>
      <StepHeading
        emoji="🪪"
        title="Last step — verify it's you"
        sub="An admin reviews these to unlock applying for shifts."
      />

      <div className="grid grid-cols-2 gap-4">
        <UploadTile
          label="NID front"
          hint="Clear, all corners visible"
          emoji="🪪"
          purpose="nid_front"
          value={props.nidFront}
          onChange={props.setNidFront}
        />
        <UploadTile
          label="NID back"
          hint="Clear and readable"
          emoji="🪪"
          purpose="nid_back"
          value={props.nidBack}
          onChange={props.setNidBack}
        />
        <UploadTile
          label="Selfie"
          hint="A live photo of you"
          emoji="🤳"
          purpose="selfie"
          value={props.selfie}
          onChange={props.setSelfie}
        />
        <UploadTile
          label="Student ID"
          hint="Boosts your trust score"
          emoji="🎓"
          purpose="student_id"
          value={props.studentId}
          onChange={props.setStudentId}
          optional
        />
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-xl bg-cream p-3 text-[12px] text-text-secondary">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald" />
        Your documents are stored securely and used only for verification.
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
      <h1 className="mt-6 text-2xl font-bold text-ink">You&apos;re all set! 🎉</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-6 text-text-secondary">
        Your profile is in for review. We&apos;ll ping you the moment an admin verifies you — then you
        can start applying for shifts.
      </p>
      <Button fullWidth onClick={onDone} className="mt-8">
        Explore shifts
      </Button>
    </div>
  );
}
