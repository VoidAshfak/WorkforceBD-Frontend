import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  Application,
  ApplicationStatus,
  CheckInMethod,
  Coordinates,
  Paginated,
  Shift,
  ShiftDashboard,
  ShiftFilter,
} from "@/types/shift";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/** Query args for the discovery feed. */
export type ShiftsQuery = {
  filter?: ShiftFilter;
  zone_id?: string;
  category_id?: string;
  page?: number;
  limit?: number;
};

/** Query args for the application tracker. */
export type ApplicationsQuery = {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
};

/**
 * Worker shift discovery + apply. Talks only to the local BFF (`/api/shifts*`,
 * `/api/applications`), which injects the access token from httpOnly cookies.
 */
export const shiftsApi = createApi({
  reducerPath: "shiftsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["Shift", "Application"],
  endpoints: (build) => ({
    getDashboard: build.query<ShiftDashboard, void>({
      query: () => ({ url: "/shifts/dashboard", method: "GET" }),
      transformResponse: (res: ApiEnvelope<ShiftDashboard>) => res.data,
    }),

    getShifts: build.query<Paginated<Shift>, ShiftsQuery>({
      query: (args) => ({ url: "/shifts", method: "GET", params: cleanParams(args) }),
      transformResponse: (res: ApiEnvelope<Paginated<Shift>>) => res.data,
      // One cache entry per filter (page excluded from the key) so paging
      // accumulates into a single growing list for "Load more".
      serializeQueryArgs: ({ queryArgs }) => {
        const { filter, zone_id, category_id } = queryArgs;
        return { filter, zone_id, category_id };
      },
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page,
      providesTags: ["Shift"],
    }),

    getShift: build.query<Shift, string>({
      query: (id) => ({ url: `/shifts/${id}`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<Shift>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "Shift", id }],
    }),

    applyToShift: build.mutation<{ message: string }, { shift_id: string; note?: string }>({
      query: (body) => ({ url: "/applications", method: "POST", body }),
      invalidatesTags: ["Application"],
    }),

    getApplications: build.query<Paginated<Application>, ApplicationsQuery>({
      query: (args) => ({ url: "/applications", method: "GET", params: cleanParams(args) }),
      transformResponse: (res: ApiEnvelope<Paginated<Application>>) => res.data,
      // One cache entry per status filter (page excluded) so paging accumulates
      // into a single growing list for "Load more".
      serializeQueryArgs: ({ queryArgs }) => ({ status: queryArgs.status }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Application"],
    }),

    withdrawApplication: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/applications/${id}/withdraw`, method: "PATCH" }),
      invalidatesTags: ["Application"],
    }),

    // Check-in/out don't change the application's status (stays `accepted`), so
    // they skip cache invalidation — the card tracks attendance state locally
    // from each mutation's result.
    checkIn: build.mutation<
      { id: string; checked_in_at: string; checkin_method: CheckInMethod },
      { id: string; method: CheckInMethod; coordinates?: Coordinates; qr_token?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/applications/${id}/check-in`,
        method: "POST",
        body,
      }),
      transformResponse: (res: ApiEnvelope<{ id: string; checked_in_at: string; checkin_method: CheckInMethod }>) =>
        res.data,
    }),

    checkOut: build.mutation<{ id: string; checked_out_at: string }, string>({
      query: (id) => ({ url: `/applications/${id}/check-out`, method: "POST" }),
      transformResponse: (res: ApiEnvelope<{ id: string; checked_out_at: string }>) => res.data,
    }),
  }),
});

/** Drops undefined/empty values so the URL only carries real filters. */
function cleanParams(args: ShiftsQuery | ApplicationsQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export const {
  useGetDashboardQuery,
  useGetShiftsQuery,
  useGetShiftQuery,
  useApplyToShiftMutation,
  useGetApplicationsQuery,
  useWithdrawApplicationMutation,
  useCheckInMutation,
  useCheckOutMutation,
} = shiftsApi;
