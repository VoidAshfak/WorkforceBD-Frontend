import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type { SessionPayload } from "@/types/auth";
import type { Role } from "@/lib/validation/auth";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/**
 * Talks to the local BFF (`/api/auth/*`), never the backend directly.
 * The BFF injects tokens from httpOnly cookies, so requests just need credentials.
 */
export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/auth", credentials: "same-origin" }),
  tagTypes: ["Session"],
  endpoints: (build) => ({
    sendOtp: build.mutation<{ message: string }, { phone: string }>({
      query: (body) => ({ url: "/send-otp", method: "POST", body }),
    }),

    verifyOtp: build.mutation<
      SessionPayload,
      { phone: string; otp_code: string; role: Role }
    >({
      query: (body) => ({ url: "/verify-otp", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<SessionPayload>) => res.data,
      invalidatesTags: ["Session"],
    }),

    getMe: build.query<SessionPayload, void>({
      query: () => ({ url: "/me", method: "GET" }),
      transformResponse: (res: ApiEnvelope<SessionPayload>) => res.data,
      providesTags: ["Session"],
    }),

    // Flips the active account context for a dual-role user (worker ⇄ business).
    // The BFF swaps the access cookie to the new-context token returned here.
    switchRole: build.mutation<SessionPayload, { role: Role }>({
      query: (body) => ({ url: "/switch-role", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<SessionPayload>) => res.data,
      invalidatesTags: ["Session"],
    }),

    logout: build.mutation<{ message: string }, void>({
      query: () => ({ url: "/logout", method: "POST" }),
      invalidatesTags: ["Session"],
    }),
  }),
});

export const {
  useSendOtpMutation,
  useVerifyOtpMutation,
  useGetMeQuery,
  useSwitchRoleMutation,
  useLogoutMutation,
} = authApi;
