import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { Dispute, DisputeList, Rating, RatingList } from "@/types/engagement";
import type { DisputeInput, RatingInput } from "@/lib/validation/engagement";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/** Query args for the caller's dispute list. */
type DisputesQuery = { status?: string; page?: number; limit?: number };

/** Query args for the caller's ratings. */
type RatingsQuery = { direction?: "received" | "given"; page?: number; limit?: number };

/**
 * Party-based disputes + ratings. Talks only to the local BFF (`/api/disputes`,
 * `/api/ratings`), which injects the access token from httpOnly cookies. Both
 * modules are usable by either party to an assignment regardless of active role.
 */
export const engagementApi = createApi({
  reducerPath: "engagementApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", credentials: "same-origin" }),
  tagTypes: ["Dispute", "Rating"],
  endpoints: (build) => ({
    getDisputes: build.query<DisputeList, DisputesQuery>({
      query: (args) => ({ url: "/disputes", method: "GET", params: clean(args) }),
      transformResponse: (res: ApiEnvelope<DisputeList>) => res.data,
      serializeQueryArgs: ({ queryArgs }) => ({ status: queryArgs.status }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Dispute"],
    }),

    raiseDispute: build.mutation<Dispute, DisputeInput>({
      query: (body) => ({ url: "/disputes", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<Dispute>) => res.data,
      invalidatesTags: ["Dispute"],
    }),

    getRatings: build.query<RatingList, RatingsQuery>({
      query: (args) => ({ url: "/ratings", method: "GET", params: clean(args) }),
      transformResponse: (res: ApiEnvelope<RatingList>) => res.data,
      serializeQueryArgs: ({ queryArgs }) => ({ direction: queryArgs.direction ?? "received" }),
      merge: (current, incoming, { arg }) => {
        if ((arg.page ?? 1) <= 1) return incoming;
        current.items.push(...incoming.items);
        current.pagination = incoming.pagination;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["Rating"],
    }),

    submitRating: build.mutation<Rating, RatingInput>({
      query: (body) => ({ url: "/ratings", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<Rating>) => res.data,
      invalidatesTags: ["Rating"],
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
  useGetDisputesQuery,
  useRaiseDisputeMutation,
  useGetRatingsQuery,
  useSubmitRatingMutation,
} = engagementApi;
