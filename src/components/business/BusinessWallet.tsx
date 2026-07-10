"use client";

import { useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";

import TopupSheet from "@/components/business/TopupSheet";
import Button from "@/components/ui/Button";
import { gsap, useGSAP } from "@/lib/gsap";
import {
  useGetBusinessWalletQuery,
  useGetBusinessWalletTransactionsQuery,
} from "@/store/api/businessApi";
import { formatRelativeTime, formatTaka } from "@/lib/format";
import type { BusinessWalletTxn } from "@/types/business";

export default function BusinessWallet() {
  const [topupOpen, setTopupOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: wallet, isLoading, isError, refetch } = useGetBusinessWalletQuery();

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-light/70 via-background to-background"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">Wallet</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-[12px] font-bold text-ink">
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
                Spendable balance
              </p>
              <p className="mt-1 text-[34px] font-bold leading-none">{formatTaka(wallet.balance)}</p>

              <div className="mt-4 flex items-center gap-4 text-[12px] text-white/70">
                <span>
                  In escrow <b className="text-white">{formatTaka(wallet.held)}</b>
                </span>
                <span className="h-3 w-px bg-white/20" />
                <span>
                  Paid out <b className="text-white">{formatTaka(wallet.total_spent)}</b>
                </span>
              </div>

              <Button
                fullWidth
                onClick={() => setTopupOpen(true)}
                className="mt-4 bg-brand text-ink hover:opacity-90"
              >
                <Plus size={18} /> Add funds
              </Button>
            </section>

            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-[12px] text-text-secondary">
              <Wallet size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
              <span>
                Posting a shift holds its cost in <b className="text-ink">escrow</b>. Unused escrow
                returns here at settlement.
              </span>
            </div>

            <h2 className="mt-5 text-[15px] font-bold text-ink">Transactions</h2>
            <div className="mt-2.5">
              <LedgerList />
            </div>
          </>
        )}
      </div>

      <TopupSheet
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        onDone={(msg) => {
          setTopupOpen(false);
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
  const { data, isLoading, isFetching } = useGetBusinessWalletTransactionsQuery({ page, limit: 15 });

  const items = data?.items ?? [];
  const hasMore = data ? data.pagination.page < data.pagination.total_pages : false;

  if (isLoading) return <RowSkeleton />;
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light">
          <Receipt size={20} className="text-ink" />
        </span>
        <p className="max-w-xs text-[13px] text-text-secondary">
          No activity yet. Top-ups, escrow holds, and settlements show up here.
        </p>
      </div>
    );

  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <TransactionRow key={t.id} txn={t} index={i} />
      ))}
      {hasMore ? (
        <button
          type="button"
          disabled={isFetching}
          onClick={() => setPage((p) => p + 1)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink active:scale-[0.99] disabled:opacity-50"
        >
          {isFetching ? <Loader2 size={16} className="animate-spin" /> : null}
          {isFetching ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}

function TransactionRow({ txn, index }: { txn: BusinessWalletTxn; index: number }) {
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
          credit ? "bg-emerald/10 text-emerald" : "bg-ink/5 text-ink"
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
        <p className="text-[11px] text-text-tertiary">held {formatTaka(txn.held_after)}</p>
      </div>
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
      <div className="h-44 rounded-3xl bg-black/[0.06]" />
      <div className="h-12 rounded-2xl bg-black/[0.06]" />
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
