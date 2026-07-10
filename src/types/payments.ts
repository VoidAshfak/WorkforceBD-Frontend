/** Worker payments-domain shapes (see /docs/api-guidelines.md → Payments & Wallet). */

import type { Pagination } from "@/types/shift";

/**
 * Worker wallet snapshot (`GET /payments/wallet`). Money balances are decimal
 * strings; the derived stats come back as plain numbers.
 */
export type WorkerWallet = {
  id: string;
  balance: string;
  total_earned: string;
  total_withdrawn: string;
  currency: string;
  /** Flat pay for `completed` but not-yet-settled shifts the worker checked in to. */
  pending_settlement: number;
  /** Earning credits in the last 7 days. */
  weekly_earnings: number;
  shifts_completed: number;
};

/**
 * One row of a wallet ledger (`GET /payments/wallet/transactions`). `credit` =
 * funds in, `debit` = funds out/held. `shift_id` is `null` for payouts/refunds.
 */
export type WalletTransaction = {
  id: string;
  type: "credit" | "debit";
  amount: string;
  balance_after: string;
  description: string;
  shift_id: string | null;
  reference_id: string | null;
  created_at: string;
};

export type WalletTransactionList = {
  items: WalletTransaction[];
  pagination: Pagination;
};

/** MFS/bank channel for a payout or top-up. */
export type PayoutMethod = "bkash" | "nagad" | "bank_transfer";

/** Lifecycle of a withdrawal request. */
export type PayoutStatus = "pending" | "sent" | "failed";

/** A worker's withdrawal request (`GET /payments/payouts`). Account is masked. */
export type Payout = {
  id: string;
  amount: string;
  method: PayoutMethod;
  account_number: string;
  account_name: string | null;
  status: PayoutStatus;
  failure_reason: string | null;
  created_at: string;
};

export type PayoutList = {
  items: Payout[];
  pagination: Pagination;
};
