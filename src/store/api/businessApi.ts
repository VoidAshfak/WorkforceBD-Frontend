import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  ApplicantDecision,
  ApplicantList,
  BulkAction,
  BulkResult,
  BusinessDashboard,
  BusinessProfile,
  BusinessShift,
  BusinessShiftDetail,
  BusinessShiftList,
  BusinessWallet,
  Category,
} from "@/types/business";
import type {
  BusinessDocumentsInput,
  BusinessLocationInput,
  BusinessPreferencesInput,
  BusinessProfileInput,
  CreateShiftInput,
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
  tagTypes: ["BizDashboard", "BizWallet", "BizShift", "BizProfile", "BizApplicants"],
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

    createShift: build.mutation<BusinessShift, CreateShiftInput>({
      query: (body) => ({ url: "/business/shifts", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<BusinessShift>) => res.data,
      // A new shift changes the home counters, the list, and (escrow) the wallet.
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
  useGetCategoriesQuery,
  useGetBusinessShiftsQuery,
  useGetBusinessShiftQuery,
  useGetShiftApplicantsQuery,
  useDecideApplicantMutation,
  useBulkDecideApplicantsMutation,
  useCreateShiftMutation,
} = businessApi;
