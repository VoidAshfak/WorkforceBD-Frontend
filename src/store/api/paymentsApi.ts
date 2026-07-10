import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  Payout,
  PayoutList,
  PayoutStatus,
  WalletTransactionList,
  WorkerWallet,
} from "@/types/payments";
import type { PayoutInput } from "@/lib/validation/payments";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/** Query args for a paginated worker ledger. */
type LedgerQuery = { page?: number; limit?: number };

/** Query args for the worker's payout history. */
type PayoutsQuery = { status?: PayoutStatus; page?: number; limit?: number };

/**
 * Worker payments API — wallet snapshot, ledger, and withdrawal (payout)
 * requests. Talks only to the local BFF (`/api/payments/*`), which injects the
 * access token from httpOnly cookies — the browser never holds a token.
 */
export const paymentsApi = createApi({
  reducerPath: "paymentsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["Wallet", "WalletTxn", "Payout"],
  endpoints: (build) => ({
    getWallet: build.query<WorkerWallet, void>({
      query: () => ({ url: "/payments/wallet", method: "GET" }),
      transformResponse: (res: ApiEnvelope<WorkerWallet>) => res.data,
      providesTags: ["Wallet"],
    }),

    getWalletTransactions: build.query<WalletTransactionList, LedgerQuery>({
      query: (args) => ({ url: "/payments/wallet/transactions", method: "GET", params: clean(args) }),
      transformResponse: (res: ApiEnvelope<WalletTransactionList>) => res.data,
      // Single growing list for "load more" — page excluded from the cache key.
      serializeQueryArgs: () => "ledger",
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["WalletTxn"],
    }),

    getPayouts: build.query<PayoutList, PayoutsQuery>({
      query: (args) => ({ url: "/payments/payouts", method: "GET", params: clean(args) }),
      transformResponse: (res: ApiEnvelope<PayoutList>) => res.data,
      serializeQueryArgs: ({ queryArgs }) => ({ status: queryArgs.status }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Payout"],
    }),

    requestPayout: build.mutation<Payout, PayoutInput>({
      query: (body) => ({ url: "/payments/payouts", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<Payout>) => res.data,
      // A payout holds (debits) the balance now and adds a ledger + payout row.
      invalidatesTags: ["Wallet", "WalletTxn", "Payout"],
    }),
  }),
});

/** Drops undefined/empty values so the URL only carries real filters. */
function clean(args: Record<string, string | number | undefined>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export const {
  useGetWalletQuery,
  useGetWalletTransactionsQuery,
  useGetPayoutsQuery,
  useRequestPayoutMutation,
} = paymentsApi;
