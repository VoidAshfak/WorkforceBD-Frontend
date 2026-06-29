"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Briefcase,
  Clock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  useGetBusinessDashboardQuery,
  useGetBusinessShiftsQuery,
  useGetBusinessWalletQuery,
} from "@/store/api/businessApi";
import type { BusinessShift } from "@/types/business";
import { formatShiftDate, formatTaka } from "@/lib/format";

/**
 * Business home — an operational control center: live staffing counters, the
 * wallet balance that funds shift escrow, a prominent "create shift" action, and
 * a preview of the business's active shifts. Mirrors the worker home's slim,
 * mobile-first layout. Shown when `activeRole === "business"`.
 */
export default function BusinessHome({
  name,
  hasProfile,
  status,
}: {
  name?: string;
  hasProfile: boolean;
  status?: string;
}) {
  const router = useRouter();

  // Counters, wallet, and the active-shift preview only exist once a business
  // profile does — skip the calls (which would 404) until then.
  const dashboard = useGetBusinessDashboardQuery(undefined, { skip: !hasProfile });
  const wallet = useGetBusinessWalletQuery(undefined, { skip: !hasProfile });
  const shifts = useGetBusinessShiftsQuery(
    { status: "published", limit: 5 },
    { skip: !hasProfile },
  );

  const d = dashboard.data;
  const activeShifts = shifts.data?.items ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="flex shrink-0 items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">
            {name ? `Hi, ${name} 👋` : "Your control center"}
          </h1>
          <p className="text-[13px] text-text-secondary">Here&apos;s how staffing looks today.</p>
        </div>
      </header>

      {!hasProfile ? (
        <div className="pt-3">
          <SetupBanner onClick={() => router.push("/onboarding/business")} />
        </div>
      ) : (
        <>
          {status && status !== "verified" ? (
            <div className="pt-3">
              <VerifyNote status={status} onVerify={() => router.push("/onboarding/business")} />
            </div>
          ) : null}

          <div className="pt-4">
            <WalletStrip
              balance={wallet.data?.balance}
              held={wallet.data?.held}
              loading={wallet.isLoading}
              onTopUp={() => router.push("/wallet")}
            />
          </div>

          <section className="grid grid-cols-2 gap-3 pt-4">
            <StatCard
              icon={Briefcase}
              label="Active shifts"
              value={d?.active_shifts}
              loading={dashboard.isLoading}
              tone="ink"
            />
            <StatCard
              icon={Users}
              label="Applicants waiting"
              value={d?.applicants_waiting}
              loading={dashboard.isLoading}
              tone="sky"
              highlight={!!d && d.applicants_waiting > 0}
            />
            <StatCard
              icon={Zap}
              label="Need staffing"
              value={d?.urgent_staffing}
              loading={dashboard.isLoading}
              tone="warning"
              highlight={!!d && d.urgent_staffing > 0}
            />
            <StatCard
              icon={TrendingUp}
              label="Fill rate"
              value={d?.fill_rate}
              suffix="%"
              loading={dashboard.isLoading}
              tone="emerald"
            />
          </section>

          {dashboard.isError ? (
            <button
              type="button"
              onClick={() => dashboard.refetch()}
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[13px] font-medium text-text-secondary active:scale-[0.99]"
            >
              <RefreshCw size={14} /> Couldn&apos;t load stats — retry
            </button>
          ) : null}

          <div className="pt-5">
            <CreateShiftCta
              verified={status === "verified"}
              onClick={() =>
                router.push(status === "verified" ? "/shifts/new" : "/onboarding/business")
              }
            />
          </div>

          <section className="pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">Active shifts</h2>
              {activeShifts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/activity")}
                  className="text-[12px] font-semibold text-sky"
                >
                  See all
                </button>
              ) : null}
            </div>

            <div className="pt-3">
              {shifts.isLoading ? (
                <ShiftListSkeleton />
              ) : activeShifts.length > 0 ? (
                <ul className="space-y-2.5">
                  {activeShifts.map((s) => (
                    <ShiftRow
                      key={s.id}
                      shift={s}
                      onClick={() => router.push(`/shifts/${s.id}`)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyShifts onCreate={() => router.push("/shifts/new")} />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------- Pieces --------------------------------- */

const TONES = {
  ink: { bg: "bg-ink/[0.06]", icon: "text-ink" },
  sky: { bg: "bg-sky/10", icon: "text-sky" },
  warning: { bg: "bg-warning/15", icon: "text-text-muted" },
  emerald: { bg: "bg-emerald/10", icon: "text-emerald" },
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  loading,
  tone,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  suffix?: string;
  loading: boolean;
  tone: keyof typeof TONES;
  highlight?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`rounded-card border bg-surface p-4 ${
        highlight ? "border-sky/40" : "border-border"
      }`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${t.bg}`}>
        <Icon size={17} className={t.icon} strokeWidth={2.2} />
      </span>
      <p className="mt-3 text-2xl font-bold text-ink">
        {loading ? (
          <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-black/[0.07]" />
        ) : (
          <>
            {value ?? 0}
            {suffix ? <span className="text-base font-semibold text-text-tertiary">{suffix}</span> : null}
          </>
        )}
      </p>
      <p className="text-[12px] font-medium text-text-secondary">{label}</p>
    </div>
  );
}

function WalletStrip({
  balance,
  held,
  loading,
  onTopUp,
}: {
  balance?: string;
  held?: string;
  loading: boolean;
  onTopUp: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-card bg-ink p-4 text-white">
      <div className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/70">
          <Wallet size={13} /> Wallet balance
        </span>
        <p className="mt-1 text-xl font-bold">
          {loading ? (
            <span className="inline-block h-6 w-24 animate-pulse rounded-md bg-white/15" />
          ) : (
            formatTaka(balance ?? 0)
          )}
        </p>
        {held && Number(held) > 0 ? (
          <p className="text-[11px] text-white/60">{formatTaka(held)} held in escrow</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onTopUp}
        className="flex shrink-0 items-center gap-1 rounded-pill bg-brand px-4 py-2 text-[13px] font-bold text-ink active:scale-95"
      >
        Top up <ArrowUpRight size={15} />
      </button>
    </div>
  );
}

function CreateShiftCta({ verified, onClick }: { verified: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card bg-brand p-4 text-left active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <Plus size={22} strokeWidth={2.4} />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-bold text-ink">Create a shift</span>
        <span className="block text-[12px] text-text-muted">
          {verified ? "Post a job and start hiring in minutes" : "Get verified first to start posting"}
        </span>
      </span>
      <ArrowUpRight size={18} className="text-ink/60" />
    </button>
  );
}

function ShiftRow({ shift, onClick }: { shift: BusinessShift; onClick: () => void }) {
  const waiting = shift.applicants_waiting;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{shift.title}</p>
          <p className="truncate text-[12px] text-text-secondary">
            {formatShiftDate(shift.shift_date)} · {formatTaka(shift.pay_amount)}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              {shift.filled}/{shift.capacity} hired
            </span>
            {waiting > 0 ? (
              <span className="rounded-full bg-sky/10 px-2 py-0.5 text-[11px] font-semibold text-sky">
                {waiting} waiting
              </span>
            ) : null}
          </div>
        </div>
        <StatusDot status={shift.status} />
      </button>
    </li>
  );
}

function StatusDot({ status }: { status: string }) {
  const open = status === "published" || status === "applications_open";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        open ? "bg-emerald/10 text-emerald" : "bg-black/[0.06] text-text-tertiary"
      }`}
    >
      {open ? "Live" : status.replace(/_/g, " ")}
    </span>
  );
}

function VerifyNote({ status, onVerify }: { status: string; onVerify: () => void }) {
  const pending = status === "pending";

  if (pending) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-warning/15 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/30 text-text-muted">
          <Clock size={16} />
        </span>
        <p className="text-[12px] text-text-secondary">
          Verification under review. You&apos;ll be able to post shifts and hire once an admin
          approves your documents.
        </p>
      </div>
    );
  }

  // unverified / rejected → must submit (or re-submit) documents to unlock posting.
  return (
    <button
      type="button"
      onClick={onVerify}
      className="flex w-full items-center gap-3 rounded-2xl bg-brand p-3.5 text-left active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <ShieldCheck size={16} />
      </span>
      <div>
        <p className="text-[14px] font-bold text-ink">
          {status === "rejected" ? "Re-submit your documents" : "Get verified to post shifts"}
        </p>
        <p className="text-[12px] text-text-muted">
          Submit your business documents to unlock posting and hiring.
        </p>
      </div>
    </button>
  );
}

function SetupBanner({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-brand p-3.5 text-left active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <Sparkles size={16} />
      </span>
      <div>
        <p className="text-[14px] font-bold text-ink">Set up your business profile</p>
        <p className="text-[12px] text-text-muted">
          Create your profile to start posting shifts and hiring workers.
        </p>
      </div>
    </button>
  );
}

function EmptyShifts({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
        <Briefcase size={22} className="text-ink" />
      </span>
      <p className="max-w-xs text-[13px] text-text-secondary">
        No active shifts yet. Post your first one to start receiving applicants.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-pill bg-ink px-5 py-2.5 text-[13px] font-semibold text-white active:scale-95"
      >
        Create a shift
      </button>
    </div>
  );
}

function ShiftListSkeleton() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-[88px] animate-pulse rounded-card bg-black/[0.05]" />
      ))}
    </ul>
  );
}
