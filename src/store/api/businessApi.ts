import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  ApplicantDecision,
  ApplicantList,
  AssignmentAction,
  AssignmentActionResult,
  BulkAction,
  BulkResult,
  BusinessDashboard,
  BusinessProfile,
  BusinessShift,
  BusinessShiftDetail,
  BusinessShiftList,
  BusinessWallet,
  BusinessWalletTxnList,
  CancellationPreview,
  Category,
  DeleteShiftInput,
  SettleResult,
  ShiftRoster,
} from "@/types/business";
import type {
  BusinessDocumentsInput,
  BusinessLocationInput,
  BusinessPreferencesInput,
  BusinessProfileInput,
  CreateShiftInput,
  TopupInput,
} from "@/lib/validation/business";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/** Query args for the business's own shift list. */
export type BusinessShiftsQuery = {
  status?: string;
  page?: number;
  limit?: number;
};

/** Query args for an owned shift's applicants. */
export type ApplicantsQuery = {
  shiftId: string;
  status?: string;
  page?: number;
  limit?: number;
};

/**
 * Business operations API — home dashboard, wallet, shift creation/listing, and
 * the shared category catalog. Talks only to the local BFF (`/api/business/*`,
 * `/api/categories`), which injects the access token from httpOnly cookies.
 */
export const businessApi = createApi({
  reducerPath: "businessApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: [
    "BizDashboard",
    "BizWallet",
    "BizWalletTxn",
    "BizShift",
    "BizProfile",
    "BizApplicants",
    "BizRoster",
  ],
  endpoints: (build) => ({
    getBusinessProfile: build.query<BusinessProfile, void>({
      query: () => ({ url: "/business/profile", method: "GET" }),
      transformResponse: (res: ApiEnvelope<BusinessProfile>) => res.data,
      providesTags: ["BizProfile"],
    }),

    createBusinessProfile: build.mutation<BusinessProfile, BusinessProfileInput>({
      query: (body) => ({ url: "/business/profile", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<BusinessProfile>) => res.data,
      invalidatesTags: ["BizProfile", "BizDashboard", "BizWallet"],
    }),

    saveBusinessLocation: build.mutation<BusinessProfile, BusinessLocationInput>({
      query: (body) => ({ url: "/business/profile/location", method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<BusinessProfile>) => res.data,
      invalidatesTags: ["BizProfile"],
    }),

    saveBusinessDocuments: build.mutation<BusinessProfile, BusinessDocumentsInput>({
      query: (body) => ({ url: "/business/profile/documents", method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<BusinessProfile>) => res.data,
      invalidatesTags: ["BizProfile"],
    }),

    saveBusinessPreferences: build.mutation<BusinessProfile, BusinessPreferencesInput>({
      query: (body) => ({ url: "/business/profile/preferences", method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<BusinessProfile>) => res.data,
      invalidatesTags: ["BizProfile"],
    }),

    getBusinessDashboard: build.query<BusinessDashboard, void>({
      query: () => ({ url: "/business/dashboard", method: "GET" }),
      transformResponse: (res: ApiEnvelope<BusinessDashboard>) => res.data,
      providesTags: ["BizDashboard"],
    }),

    getBusinessWallet: build.query<BusinessWallet, void>({
      query: () => ({ url: "/business/wallet", method: "GET" }),
      transformResponse: (res: ApiEnvelope<BusinessWallet>) => res.data,
      providesTags: ["BizWallet"],
    }),

    getBusinessWalletTransactions: build.query<
      BusinessWalletTxnList,
      { page?: number; limit?: number }
    >({
      query: (args) => ({
        url: "/business/wallet/transactions",
        method: "GET",
        params: cleanParams(args),
      }),
      transformResponse: (res: ApiEnvelope<BusinessWalletTxnList>) => res.data,
      // Single growing list for "load more" — page excluded from the cache key.
      serializeQueryArgs: () => "ledger",
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["BizWalletTxn"],
    }),

    topupWallet: build.mutation<BusinessWallet, TopupInput>({
      query: (body) => ({ url: "/business/wallet/topup", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<BusinessWallet>) => res.data,
      // New funds change the balance and add a ledger row.
      invalidatesTags: ["BizWallet", "BizWalletTxn"],
    }),

    getCategories: build.query<Category[], void>({
      query: () => ({ url: "/categories", method: "GET" }),
      transformResponse: (res: ApiEnvelope<Category[]>) => res.data,
    }),

    getBusinessShifts: build.query<BusinessShiftList, BusinessShiftsQuery>({
      query: (args) => ({ url: "/business/shifts", method: "GET", params: cleanParams(args) }),
      transformResponse: (res: ApiEnvelope<BusinessShiftList>) => res.data,
      // One cache entry per status filter (page excluded) so paging accumulates
      // into a single growing list for "Load more".
      serializeQueryArgs: ({ queryArgs }) => ({ status: queryArgs.status }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["BizShift"],
    }),

    getBusinessShift: build.query<BusinessShiftDetail, string>({
      query: (id) => ({ url: `/business/shifts/${id}`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<BusinessShiftDetail>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "BizShift", id }],
    }),

    getShiftApplicants: build.query<ApplicantList, ApplicantsQuery>({
      query: ({ shiftId, ...rest }) => ({
        url: `/business/shifts/${shiftId}/applicants`,
        method: "GET",
        params: cleanParams(rest),
      }),
      transformResponse: (res: ApiEnvelope<ApplicantList>) => res.data,
      // One cache entry per (shift, status) — page excluded so "load more" grows
      // the same list.
      serializeQueryArgs: ({ queryArgs }) => ({ shiftId: queryArgs.shiftId, status: queryArgs.status }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["BizApplicants"],
    }),

    decideApplicant: build.mutation<
      { id: string; status: string },
      { id: string; decision: ApplicantDecision; shiftId: string }
    >({
      query: ({ id, decision }) => ({
        url: `/business/applications/${id}/${decision}`,
        method: "PATCH",
      }),
      transformResponse: (res: ApiEnvelope<{ id: string; status: string }>) => res.data,
      // A decision changes the applicant list, the shift's staffing counters
      // (accept fills a slot, toggles is_editable), and the home dashboard.
      invalidatesTags: (_r, _e, { shiftId }) => [
        "BizApplicants",
        "BizDashboard",
        { type: "BizShift", id: shiftId },
      ],
    }),

    bulkDecideApplicants: build.mutation<
      BulkResult,
      { shiftId: string; action: BulkAction; application_ids: string[] }
    >({
      query: ({ shiftId, action, application_ids }) => ({
        url: `/business/shifts/${shiftId}/applicants/bulk`,
        method: "POST",
        body: { action, application_ids },
      }),
      transformResponse: (res: ApiEnvelope<BulkResult>) => res.data,
      invalidatesTags: (_r, _e, { shiftId }) => [
        "BizApplicants",
        "BizDashboard",
        { type: "BizShift", id: shiftId },
      ],
    }),

    // Live-attendance roster. The `checkin_code` rotates ~30 s, so the roster
    // view polls; keep the cache short-lived and tagged for handshake actions.
    getShiftRoster: build.query<ShiftRoster, string>({
      query: (id) => ({ url: `/business/shifts/${id}/roster`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<ShiftRoster>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "BizRoster", id }],
    }),

    // Completion-handshake action on a roster assignment. `confirm` pays the
    // worker (touches the wallet); `no-show` returns the escrow slice. All three
    // move the roster + shift status, so refresh the roster, wallet, and shift.
    actOnAssignment: build.mutation<
      AssignmentActionResult,
      { assignmentId: string; action: AssignmentAction; shiftId: string }
    >({
      query: ({ assignmentId, action }) => ({
        url: `/business/assignments/${assignmentId}/${action}`,
        method: "POST",
      }),
      transformResponse: (res: ApiEnvelope<AssignmentActionResult>) => res.data,
      invalidatesTags: (_r, _e, { shiftId }) => [
        { type: "BizRoster", id: shiftId },
        { type: "BizShift", id: shiftId },
        "BizWallet",
        "BizDashboard",
      ],
    }),

    // Confirm-everything settle shortcut — closes every open handshake on a
    // completed shift. Pays workers (wallet) and advances the shift status.
    settleShift: build.mutation<SettleResult, string>({
      query: (shiftId) => ({ url: `/payments/shifts/${shiftId}/settle`, method: "POST" }),
      transformResponse: (res: ApiEnvelope<SettleResult>) => res.data,
      invalidatesTags: (_r, _e, shiftId) => [
        { type: "BizRoster", id: shiftId },
        { type: "BizShift", id: shiftId },
        "BizWallet",
        "BizDashboard",
      ],
    }),

    createShift: build.mutation<BusinessShift, CreateShiftInput>({
      query: (body) => ({ url: "/business/shifts", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<BusinessShift>) => res.data,
      // A new shift changes the home counters, the list, and (escrow) the wallet.
      invalidatesTags: ["BizShift", "BizDashboard", "BizWallet"],
    }),

    // Dry-run cancel breakdown for the swipe-to-delete modal. Always refetched
    // (staffing/timing shift the penalty) and never cached — read fresh per open.
    getCancellationPreview: build.query<CancellationPreview, string>({
      query: (id) => ({ url: `/business/shifts/${id}/cancellation-preview`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<CancellationPreview>) => res.data,
      keepUnusedDataFor: 0,
    }),

    deleteShift: build.mutation<{ message: string }, DeleteShiftInput>({
      query: ({ id, ...body }) => ({ url: `/business/shifts/${id}`, method: "DELETE", body }),
      transformResponse: (res: ApiEnvelope<unknown>) => ({ message: res.message }),
      // Removing a shift drops it from the list, refunds/settles escrow (wallet),
      // and moves the home counters.
      invalidatesTags: ["BizShift", "BizDashboard", "BizWallet"],
    }),
  }),
});

/** Drops undefined/empty values so the URL only carries real filters. */
function cleanParams(args: BusinessShiftsQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export const {
  useGetBusinessProfileQuery,
  useCreateBusinessProfileMutation,
  useSaveBusinessLocationMutation,
  useSaveBusinessDocumentsMutation,
  useSaveBusinessPreferencesMutation,
  useGetBusinessDashboardQuery,
  useGetBusinessWalletQuery,
  useGetBusinessWalletTransactionsQuery,
  useTopupWalletMutation,
  useGetCategoriesQuery,
  useGetBusinessShiftsQuery,
  useGetBusinessShiftQuery,
  useGetShiftApplicantsQuery,
  useDecideApplicantMutation,
  useBulkDecideApplicantsMutation,
  useGetShiftRosterQuery,
  useActOnAssignmentMutation,
  useSettleShiftMutation,
  useCreateShiftMutation,
  useGetCancellationPreviewQuery,
  useDeleteShiftMutation,
} = businessApi;
