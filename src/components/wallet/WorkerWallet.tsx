"use client";

import { useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

import PayoutSheet from "@/components/wallet/PayoutSheet";
import Button from "@/components/ui/Button";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAppSelector } from "@/store/hooks";
import {
  useGetPayoutsQuery,
  useGetWalletQuery,
  useGetWalletTransactionsQuery,
} from "@/store/api/paymentsApi";
import { formatRelativeTime, formatTaka } from "@/lib/format";
import type { Payout, PayoutStatus, WalletTransaction } from "@/types/payments";

type Tab = "ledger" | "payouts";

const PAYOUT_UI: Record<PayoutStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Processing", className: "bg-warning/20 text-text-muted", icon: Clock },
  sent: { label: "Sent", className: "bg-emerald/10 text-emerald", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-danger/10 text-danger", icon: XCircle },
};

const METHOD_LABEL: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
};

export default function WorkerWallet() {
  const [tab, setTab] = useState<Tab>("ledger");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const verification = useAppSelector((s) => s.auth.profile?.verification_status);
  const verified = verification === "verified";

  const { data: wallet, isLoading, isError, refetch } = useGetWalletQuery();

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Branded backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald/15 via-background to-background"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">Wallet</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1 text-[12px] font-bold text-emerald">
            <Wallet size={13} /> {wallet?.currency ?? "BDT"}
          </span>
        </header>

        {isLoading ? (
          <BalanceSkeleton />
        ) : isError || !wallet ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            {/* Balance hero */}
            <section className="mt-4 rounded-3xl bg-gradient-to-br from-ink to-ink-soft p-5 text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]">
              <p className="text-[12px] font-medium uppercase tracking-wide text-white/60">
                Withdrawable balance
              </p>
              <p className="mt-1 text-[34px] font-bold leading-none">{formatTaka(wallet.balance)}</p>

              <div className="mt-4 flex items-center gap-4 text-[12px] text-white/70">
                <span>
                  Earned <b className="text-white">{formatTaka(wallet.total_earned)}</b>
                </span>
                <span className="h-3 w-px bg-white/20" />
                <span>
                  Withdrawn <b className="text-white">{formatTaka(wallet.total_withdrawn)}</b>
                </span>
              </div>

              <Button
                fullWidth
                onClick={() => setPayoutOpen(true)}
                className="mt-4 bg-brand text-ink hover:opacity-90"
              >
                <ArrowUpRight size={18} /> Withdraw
              </Button>
              {!verified ? (
                <p className="mt-2 text-center text-[11px] text-white/60">
                  Get verified by an admin to withdraw.
                </p>
              ) : null}
            </section>

            {/* Stat tiles */}
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              <StatTile label="Pending" value={formatTaka(wallet.pending_settlement)} />
              <StatTile label="This week" value={formatTaka(wallet.weekly_earnings)} />
              <StatTile label="Shifts" value={String(wallet.shifts_completed)} />
            </div>

            {/* Tabs */}
            <div className="mt-5 flex gap-2">
              <TabButton active={tab === "ledger"} onClick={() => setTab("ledger")}>
                Transactions
              </TabButton>
              <TabButton active={tab === "payouts"} onClick={() => setTab("payouts")}>
                Withdrawals
              </TabButton>
            </div>

            <div className="mt-3">
              {tab === "ledger" ? <LedgerList /> : <PayoutsList />}
            </div>
          </>
        )}
      </div>

      <PayoutSheet
        open={payoutOpen}
        balance={wallet?.balance ?? "0"}
        onClose={() => setPayoutOpen(false)}
        onDone={(msg) => {
          setPayoutOpen(false);
          showToast(msg);
        }}
      />

      {toast ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-5">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
            <CheckCircle2 size={15} className="text-emerald" /> {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LedgerList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetWalletTransactionsQuery({ page, limit: 15 });

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  if (isLoading) return <RowSkeleton />;
  if (items.length === 0)
    return <EmptyRows icon={Sparkles} text="No transactions yet. Earnings from settled shifts show up here." />;

  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <TransactionRow key={t.id} txn={t} index={i} />
      ))}
      {hasMore ? <LoadMore loading={isFetching} onClick={() => setPage((p) => p + 1)} /> : null}
    </div>
  );
}

function TransactionRow({ txn, index }: { txn: WalletTransaction; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const credit = txn.type === "credit";

  useGSAP(
    () => {
      gsap.from(ref.current, {
        y: 12,
        autoAlpha: 0,
        duration: 0.4,
        ease: "power3.out",
        delay: Math.min(index, 8) * 0.04,
      });
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          credit ? "bg-emerald/10 text-emerald" : "bg-danger/10 text-danger"
        }`}
      >
        {credit ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{txn.description}</p>
        <p className="text-[11px] text-text-tertiary">{formatRelativeTime(txn.created_at)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[14px] font-bold ${credit ? "text-emerald" : "text-ink"}`}>
          {credit ? "+" : "−"}
          {formatTaka(txn.amount)}
        </p>
        <p className="text-[11px] text-text-tertiary">{formatTaka(txn.balance_after)}</p>
      </div>
    </div>
  );
}

function PayoutsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetPayoutsQuery({ page, limit: 15 });

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  if (isLoading) return <RowSkeleton />;
  if (items.length === 0)
    return <EmptyRows icon={ArrowUpRight} text="No withdrawals yet. Cash out your balance to bKash, Nagad, or a bank." />;

  return (
    <div className="space-y-2">
      {items.map((p) => (
        <PayoutRow key={p.id} payout={p} />
      ))}
      {hasMore ? <LoadMore loading={isFetching} onClick={() => setPage((p) => p + 1)} /> : null}
    </div>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const ui = PAYOUT_UI[payout.status];
  const Icon = ui.icon;
  return (
    <div className="rounded-2xl border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink">{formatTaka(payout.amount)}</p>
          <p className="truncate text-[12px] text-text-secondary">
            {METHOD_LABEL[payout.method] ?? payout.method} · {payout.account_number}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${ui.className}`}
        >
          <Icon size={12} /> {ui.label}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
        <span>{formatRelativeTime(payout.created_at)}</span>
        {payout.failure_reason ? (
          <span className="truncate text-danger">{payout.failure_reason}</span>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- bits --------------------------------- */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-2.5 text-center">
      <p className="text-[15px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
        active ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function LoadMore({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink active:scale-[0.99] disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {loading ? "Loading…" : "Load more"}
    </button>
  );
}

function EmptyRows({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light">
        <Icon size={20} className="text-ink" />
      </span>
      <p className="max-w-xs text-[13px] text-text-secondary">{text}</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning/15">
        <RefreshCw size={18} className="text-text-muted" />
      </span>
      <p className="text-[14px] text-text-secondary">Couldn&apos;t load your wallet.</p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-3">
      <div className="h-40 rounded-3xl bg-black/[0.06]" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-black/[0.06]" />
        ))}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/[0.06]" />
      ))}
    </div>
  );
}
