"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeftRight, BadgeCheck, Clock, LogOut, Pencil, ShieldX, Sparkles, Star } from "lucide-react";

import Button from "@/components/ui/Button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearSession } from "@/store/slices/authSlice";
import { useLogoutMutation, useSwitchRoleMutation } from "@/store/api/authApi";
import { useGetRatingsQuery } from "@/store/api/engagementApi";
import { workerApi, useGetWorkerProfileQuery } from "@/store/api/workerApi";
import { shiftsApi } from "@/store/api/shiftsApi";
import { businessApi } from "@/store/api/businessApi";
import { chatApi } from "@/store/api/chatApi";
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
  const [switchRole, { isLoading: switching }] = useSwitchRoleMutation();

  // Dual-role users (worker + business) can flip context. The "other" role is
  // the one they hold but aren't currently acting as.
  const otherRole = user?.roles.find((r) => r !== activeRole) ?? null;

  const onSwitchRole = async () => {
    if (!otherRole) return;
    try {
      await switchRole({ role: otherRole }).unwrap();
      // The new context re-scopes every role-bound cache: worker/shift data,
      // business data, and chat (inbox/unread/threads are filtered by active
      // role server-side). Reset them so nothing from the old role leaks through.
      // The socket reconnects with a fresh, role-scoped ticket on its own
      // (NotificationSocket keys on activeRole).
      dispatch(workerApi.util.resetApiState());
      dispatch(shiftsApi.util.resetApiState());
      dispatch(businessApi.util.resetApiState());
      dispatch(chatApi.util.resetApiState());
      router.replace("/");
    } catch {
      // Switch failed (e.g. role lost) — leave the user on the current context.
    }
  };

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
          <ProfileRating />
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

      {otherRole ? (
        <button
          type="button"
          onClick={onSwitchRole}
          disabled={switching}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left active:scale-[0.99] disabled:opacity-60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5 text-ink">
            {switching ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowLeftRight size={18} />
            )}
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold text-ink">Switch account</span>
            <span className="block text-[13px] text-text-muted capitalize">
              Switch to {otherRole} account
            </span>
          </span>
          <ArrowRight size={18} className="text-text-tertiary" />
        </button>
      ) : null}

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

/**
 * Received-ratings summary for the active account (worker or business). Ratings
 * are party-based; `direction: "received"` returns the rolling average + count
 * that the other side has given this user. Shown always — "New" before any land.
 */
function ProfileRating() {
  const { data } = useGetRatingsQuery({ direction: "received" });
  const average = data?.summary.average ?? 0;
  const count = data?.summary.count ?? 0;

  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[13px]">
      <Star size={14} className={count > 0 ? "fill-brand text-brand" : "text-text-tertiary"} />
      {count > 0 ? (
        <span className="font-semibold text-ink">
          {average.toFixed(1)}
          <span className="ml-1 font-normal text-text-tertiary">
            · {count} rating{count === 1 ? "" : "s"}
          </span>
        </span>
      ) : (
        <span className="text-text-tertiary">No ratings yet</span>
      )}
    </span>
  );
}
