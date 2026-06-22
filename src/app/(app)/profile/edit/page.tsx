"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import Button from "@/components/ui/Button";
import SelectableCard from "@/components/onboarding/SelectableCard";
import ChipSelect from "@/components/onboarding/ChipSelect";
import ProfilePictureField from "@/components/onboarding/ProfilePictureField";
import { useAppSelector } from "@/store/hooks";
import {
  useGetCatalogQuery,
  useGetWorkerProfileQuery,
  useSaveAvailabilityMutation,
  useSaveBasicMutation,
  useSaveSkillsMutation,
} from "@/store/api/workerApi";
import { DAY_OPTIONS, GENDER_OPTIONS, SLOT_OPTIONS, skillEmoji } from "@/config/onboarding";
import { createLogger } from "@/lib/logger";
import {
  basicInfoSchema,
  type AvailabilityDay,
  type AvailabilitySlot,
  type Gender,
} from "@/lib/validation/worker";
import type { WorkerProfile } from "@/types/worker";

const log = createLogger("profile:edit");

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Edit worker profile — name, photo, gender, DOB, preferred zones, skills, and
 * availability. Prefills from `GET /worker/profile` and saves each section
 * through its onboarding mutation (basic → skills → availability), which the
 * backend treats as full replacements. KYC documents are edited separately via
 * re-verification, so they're not touched here.
 */
export default function EditProfilePage() {
  const router = useRouter();
  const { activeRole } = useAppSelector((s) => s.auth);

  const { data: profile, isLoading } = useGetWorkerProfileQuery(undefined, {
    skip: activeRole !== "worker",
  });

  // Non-workers don't have an editable worker profile.
  useEffect(() => {
    if (activeRole && activeRole !== "worker") router.replace("/profile");
  }, [activeRole, router]);

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-full items-center justify-center text-text-tertiary">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  // Remount on identity change so the form re-seeds from fresh server data.
  return <EditForm key={profile.id} profile={profile} />;
}

function EditForm({ profile }: { profile: WorkerProfile }) {
  const router = useRouter();
  const { data: catalog, isLoading: catalogLoading } = useGetCatalogQuery();

  const [saveBasic, basicState] = useSaveBasicMutation();
  const [saveSkills, skillsState] = useSaveSkillsMutation();
  const [saveAvailability, availState] = useSaveAvailabilityMutation();

  // Seed once from the loaded profile (the parent remounts us on profile.id).
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [gender, setGender] = useState<Gender | undefined>(
    (profile.gender as Gender | null) ?? undefined,
  );
  const [dob, setDob] = useState(profile.date_of_birth?.slice(0, 10) ?? "");
  const [profilePicture, setProfilePicture] = useState<string | null>(
    profile.profile_picture ?? null,
  );
  const [zoneIds, setZoneIds] = useState<string[]>(
    profile.worker_preferred_zones?.map((z) => z.zone_id) ?? [],
  );
  const [skillIds, setSkillIds] = useState<string[]>(
    profile.worker_skills?.map((s) => s.skill_id) ?? [],
  );
  const [days, setDays] = useState<AvailabilityDay[]>(
    (profile.availability_days as AvailabilityDay[]) ?? [],
  );
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    (profile.availability_slots as AvailabilitySlot[]) ?? [],
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saving = basicState.isLoading || skillsState.isLoading || availState.isLoading;
  const nameValid = basicInfoSchema.safeParse({ full_name: fullName }).success;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Dirty check — Save stays disabled until the form differs from the loaded
  // profile (list fields compared order-insensitively).
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const dirty =
    fullName !== (profile.full_name ?? "") ||
    (gender ?? "") !== (profile.gender ?? "") ||
    dob !== (profile.date_of_birth?.slice(0, 10) ?? "") ||
    (profilePicture ?? "") !== (profile.profile_picture ?? "") ||
    !sameSet(zoneIds, profile.worker_preferred_zones?.map((z) => z.zone_id) ?? []) ||
    !sameSet(skillIds, profile.worker_skills?.map((s) => s.skill_id) ?? []) ||
    !sameSet(days, profile.availability_days ?? []) ||
    !sameSet(slots, profile.availability_slots ?? []);

  const onSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await saveBasic({
        full_name: fullName.trim(),
        gender,
        date_of_birth: dob || undefined,
        profile_picture: profilePicture ?? undefined,
        zone_ids: zoneIds,
      }).unwrap();

      // Skills/availability are required sets on the backend — only push them
      // when the user has a valid selection, so editing just the name can't
      // wipe them with an empty payload.
      if (skillIds.length >= 1) await saveSkills({ skill_ids: skillIds }).unwrap();
      if (days.length >= 1 && slots.length >= 1) {
        await saveAvailability({
          availability_days: days,
          availability_slots: slots,
          zone_ids: zoneIds.length ? zoneIds : undefined,
        }).unwrap();
      }

      setSaved(true);
      router.replace("/profile");
    } catch (err) {
      const message =
        (err as { data?: { message?: string } })?.data?.message ??
        "Couldn't save your changes. Try again.";
      log.warn("profile save failed", { message });
      setError(message);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-6 pb-3 pt-5 backdrop-blur">
        <button
          type="button"
          onClick={() => router.replace("/profile")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-ink">Edit profile</h1>
      </header>

      <main className="flex-1 px-6 pb-40 pt-4">
        {/* Photo */}
        <p className="mb-1.5 text-[14px] font-semibold text-ink">Profile photo</p>
        <ProfilePictureField value={profilePicture} onChange={setProfilePicture} />

        {/* Name */}
        <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Rahim Hossain"
          maxLength={100}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky"
        />

        {/* Gender */}
        <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Gender</p>
        <div className="grid grid-cols-2 gap-3">
          {GENDER_OPTIONS.map((g) => (
            <SelectableCard
              key={g.value}
              emoji={g.emoji}
              label={g.label}
              selected={gender === g.value}
              onToggle={() => setGender(g.value)}
              row
            />
          ))}
        </div>

        {/* DOB */}
        <label className="mb-1.5 mt-6 block text-[14px] font-semibold text-ink">
          Date of birth <span className="font-normal text-text-tertiary">· optional</span>
        </label>
        <input
          type="date"
          value={dob}
          max={today}
          onChange={(e) => setDob(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-sky"
        />

        {/* Zones */}
        <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Preferred work zones</p>
        {catalogLoading ? (
          <CatalogLoader />
        ) : (
          <ChipSelect
            items={catalog?.zones ?? []}
            selectedIds={zoneIds}
            onToggle={(id) => setZoneIds(toggle(zoneIds, id))}
          />
        )}

        {/* Skills */}
        <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Skills</p>
        {catalogLoading ? (
          <CatalogLoader />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(catalog?.skills ?? []).map((s) => (
              <SelectableCard
                key={s.id}
                emoji={skillEmoji(s.name)}
                label={s.name}
                selected={skillIds.includes(s.id)}
                onToggle={() => setSkillIds(toggle(skillIds, s.id))}
              />
            ))}
          </div>
        )}

        {/* Availability — days */}
        <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Which days?</p>
        <div className="grid grid-cols-2 gap-3">
          {DAY_OPTIONS.map((d) => (
            <SelectableCard
              key={d.value}
              emoji={d.emoji}
              label={d.label}
              hint={d.hint}
              selected={days.includes(d.value)}
              onToggle={() => setDays(toggle(days, d.value))}
            />
          ))}
        </div>

        {/* Availability — slots */}
        <p className="mb-2 mt-6 text-[14px] font-semibold text-ink">Which times?</p>
        <div className="grid grid-cols-3 gap-3">
          {SLOT_OPTIONS.map((s) => (
            <SelectableCard
              key={s.value}
              emoji={s.emoji}
              label={s.label}
              hint={s.hint}
              selected={slots.includes(s.value)}
              onToggle={() => setSlots(toggle(slots, s.value))}
            />
          ))}
        </div>

        {error ? <p className="mt-4 text-[13px] font-medium text-danger">{error}</p> : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background to-transparent px-6 pb-6 pt-4">
        <Button fullWidth onClick={onSave} loading={saving} disabled={!nameValid || saved || !dirty}>
          Save changes
        </Button>
      </footer>
    </div>
  );
}

function CatalogLoader() {
  return (
    <div className="flex items-center gap-2 py-4 text-text-tertiary">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-[13px]">Loading options…</span>
    </div>
  );
}
