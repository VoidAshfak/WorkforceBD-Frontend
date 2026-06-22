"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Clock, LogOut, Pencil, ShieldX, Sparkles } from "lucide-react";

import Button from "@/components/ui/Button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearSession } from "@/store/slices/authSlice";
import { useLogoutMutation } from "@/store/api/authApi";
import { useGetWorkerProfileQuery } from "@/store/api/workerApi";
import type { VerificationStatus } from "@/types/auth";

const STATUS_UI: Record<
  VerificationStatus,
  { label: string; className: string; icon: typeof BadgeCheck }
> = {
  verified: { label: "Verified", className: "bg-emerald/10 text-emerald", icon: BadgeCheck },
  pending: { label: "Under review", className: "bg-warning/20 text-text-muted", icon: Clock },
  unverified: { label: "Not verified", className: "bg-black/5 text-text-secondary", icon: ShieldX },
  rejected: { label: "Rejected", className: "bg-danger/10 text-danger", icon: ShieldX },
};

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, activeRole, profile } = useAppSelector((s) => s.auth);
  const [logout, { isLoading }] = useLogoutMutation();

  // The auth user's `full_name` is always null — the name lives on the worker
  // profile, so fetch it for workers and prefer it over the account field.
  const { data: workerProfile } = useGetWorkerProfileQuery(undefined, {
    skip: activeRole !== "worker",
  });
  const displayName = workerProfile?.full_name?.trim() || user?.full_name?.trim() || null;
  const avatarUrl = workerProfile?.profile_picture ?? null;

  const status = profile?.verification_status ?? "unverified";
  const badge = STATUS_UI[status];
  const BadgeIcon = badge.icon;

  // Worker with an unfinished profile → nudge them into the onboarding wizard.
  const showCompleteCta =
    activeRole === "worker" && status !== "verified" && Boolean(profile?.next_step);
  const completion = profile?.profile_completion ?? 0;

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // ignore — clear client session regardless
    }
    dispatch(clearSession());
    router.replace("/welcome");
  };

  return (
    <div className="flex min-h-full flex-col px-6 py-10">
      <h1 className="text-2xl font-bold text-ink">Profile</h1>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand text-xl font-bold text-ink">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName ?? "Profile"} className="h-full w-full object-cover" />
          ) : (
            (displayName?.[0] ?? "U").toUpperCase()
          )}
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold text-ink">{displayName ?? "Add your name"}</p>
          <p className="text-[14px] text-text-secondary">{user?.phone}</p>
        </div>
        {activeRole === "worker" ? (
          <button
            type="button"
            onClick={() => router.push("/profile/edit")}
            aria-label="Edit profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
          >
            <Pencil size={16} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="text-[13px] uppercase tracking-wide text-text-tertiary">Active role</p>
          <p className="text-[15px] font-semibold capitalize text-ink">{activeRole ?? "—"}</p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${badge.className}`}
        >
          <BadgeIcon size={15} />
          {badge.label}
        </span>
      </div>

      {showCompleteCta ? (
        <button
          type="button"
          onClick={() => router.push("/onboarding/worker")}
          className="mt-4 flex items-center gap-3 rounded-2xl bg-brand p-4 text-left active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <Sparkles size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-ink">Finish your profile</span>
            <span className="block text-[13px] text-text-muted">
              {completion}% done · unlock applying for shifts
            </span>
          </span>
          <ArrowRight size={18} className="text-ink" />
        </button>
      ) : null}

      <Button variant="secondary" fullWidth loading={isLoading} onClick={onLogout} className="mt-auto">
        <LogOut size={18} />
        Log out
      </Button>
    </div>
  );
}
