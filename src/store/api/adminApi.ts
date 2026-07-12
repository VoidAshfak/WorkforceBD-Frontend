import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  AdminAnalytics,
  AdminDashboard,
  AdminDisputeQueue,
  AdminLoginChallenge,
  AdminPayoutQueue,
  AdminUser,
  AdminUserDetail,
  AdminUserList,
  PlatformSetting,
  ProfileType,
  ShiftQueue,
  VerificationItem,
  VerificationQueue,
} from "@/types/admin";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

/**
 * Admin dashboard API. Every call goes to the local BFF (`/api/admin/*`), which
 * holds the admin token in httpOnly, browser-session cookies and enforces the
 * 10-minute idle window. Nothing here ever sees a token.
 *
 * A `401` from any endpoint means the session is gone (closed browser, idle
 * timeout, revoked token) — the shell watches for it and bounces to the login
 * screen.
 */
export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/admin", credentials: "same-origin" }),
  tagTypes: [
    "AdminSession",
    "AdminDashboard",
    "AdminVerification",
    "AdminShift",
    "AdminUser",
    "AdminDispute",
    "AdminPayout",
    "AdminSetting",
  ],
  endpoints: (build) => ({
    /* -------------------------------- Auth -------------------------------- */

    adminLogin: build.mutation<AdminLoginChallenge, { username: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<AdminLoginChallenge>) => res.data,
    }),

    adminVerify: build.mutation<{ user: AdminUser }, { username: string; code: string }>({
      query: (body) => ({ url: "/auth/verify", method: "POST", body }),
      transformResponse: (res: ApiEnvelope<{ user: AdminUser }>) => res.data,
      invalidatesTags: ["AdminSession"],
    }),

    /**
     * Session probe + inactivity heartbeat. `401` → not signed in.
     *
     * Proxies `GET /auth/me`, whose envelope carries the user object *directly*
     * in `data` — not nested under a `user` key like the 2FA response does.
     */
    adminSession: build.query<AdminUser, void>({
      query: () => ({ url: "/auth/session", method: "GET" }),
      transformResponse: (res: ApiEnvelope<AdminUser>) => res.data,
      providesTags: ["AdminSession"],
    }),

    adminLogout: build.mutation<{ success: boolean }, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),

    /* ------------------------------ Overview ------------------------------ */

    getAdminDashboard: build.query<AdminDashboard, void>({
      query: () => ({ url: "/dashboard", method: "GET" }),
      transformResponse: (res: ApiEnvelope<AdminDashboard>) => res.data,
      providesTags: ["AdminDashboard"],
    }),

    getAdminAnalytics: build.query<AdminAnalytics, { days?: number } | void>({
      query: (args) => ({ url: "/analytics", method: "GET", params: { days: args?.days ?? 30 } }),
      transformResponse: (res: ApiEnvelope<AdminAnalytics>) => res.data,
    }),

    /* ---------------------------- Verifications --------------------------- */

    getVerifications: build.query<
      VerificationQueue,
      { type: ProfileType; status?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/verifications", method: "GET", params }),
      transformResponse: (res: ApiEnvelope<VerificationQueue>) => res.data,
      providesTags: ["AdminVerification"],
    }),

    getVerification: build.query<VerificationItem, { id: string; type: ProfileType }>({
      query: ({ id, type }) => ({ url: `/verifications/${id}`, method: "GET", params: { type } }),
      transformResponse: (res: ApiEnvelope<VerificationItem>) => res.data,
      providesTags: (_r, _e, { id }) => [{ type: "AdminVerification", id }],
    }),

    decideVerification: build.mutation<
      { id: string; verification_status: string },
      { id: string; type: ProfileType; decision: "approve" | "reject"; note?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/verifications/${id}`, method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<{ id: string; verification_status: string }>) => res.data,
      invalidatesTags: ["AdminVerification", "AdminDashboard", "AdminUser"],
    }),

    /* ------------------------- Shift-post moderation ---------------------- */

    getModerationShifts: build.query<
      ShiftQueue,
      { status?: string; page?: number; limit?: number } | void
    >({
      query: (args) => ({
        url: "/shifts",
        method: "GET",
        params: { status: args?.status ?? "pending_approval", page: args?.page ?? 1, limit: 10 },
      }),
      transformResponse: (res: ApiEnvelope<ShiftQueue>) => res.data,
      providesTags: ["AdminShift"],
    }),

    decideShift: build.mutation<
      { id: string; status: string },
      { id: string; decision: "approve" | "reject"; note?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/shifts/${id}`, method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<{ id: string; status: string }>) => res.data,
      invalidatesTags: ["AdminShift", "AdminDashboard"],
    }),

    /* -------------------------------- Users -------------------------------- */

    getAdminUsers: build.query<
      AdminUserList,
      { role?: string; status?: string; search?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/users", method: "GET", params }),
      transformResponse: (res: ApiEnvelope<AdminUserList>) => res.data,
      providesTags: ["AdminUser"],
    }),

    getAdminUser: build.query<AdminUserDetail, string>({
      query: (id) => ({ url: `/users/${id}`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<AdminUserDetail>) => res.data,
      providesTags: (_r, _e, id) => [{ type: "AdminUser", id }],
    }),

    blockUser: build.mutation<
      { user_id: string; is_active: boolean },
      { id: string; reason: string; severity?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/users/${id}/block`, method: "POST", body }),
      transformResponse: (res: ApiEnvelope<{ user_id: string; is_active: boolean }>) => res.data,
      invalidatesTags: ["AdminUser", "AdminDashboard"],
    }),

    unblockUser: build.mutation<
      { user_id: string; is_active: boolean },
      { id: string; note?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/users/${id}/unblock`, method: "POST", body }),
      transformResponse: (res: ApiEnvelope<{ user_id: string; is_active: boolean }>) => res.data,
      invalidatesTags: ["AdminUser", "AdminDashboard"],
    }),

    /* ------------------------------ Disputes ------------------------------- */

    getAdminDisputes: build.query<
      AdminDisputeQueue,
      { status?: string; page?: number; limit?: number } | void
    >({
      query: (args) => ({
        url: "/disputes",
        method: "GET",
        params: { status: args?.status ?? "open", page: args?.page ?? 1, limit: 10 },
      }),
      transformResponse: (res: ApiEnvelope<AdminDisputeQueue>) => res.data,
      providesTags: ["AdminDispute"],
    }),

    ruleDispute: build.mutation<
      { id: string; status: string },
      {
        id: string;
        decision: "pay_full" | "pay_partial" | "deny";
        amount?: number;
        resolution_note: string;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/disputes/${id}`, method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<{ id: string; status: string }>) => res.data,
      // A ruling moves money and can close the shift — refresh the money counters too.
      invalidatesTags: ["AdminDispute", "AdminDashboard"],
    }),

    /* ------------------------------- Payouts ------------------------------- */

    getAdminPayouts: build.query<
      AdminPayoutQueue,
      { status?: string; page?: number; limit?: number } | void
    >({
      query: (args) => ({
        url: "/payouts",
        method: "GET",
        params: { status: args?.status ?? "pending", page: args?.page ?? 1, limit: 10 },
      }),
      transformResponse: (res: ApiEnvelope<AdminPayoutQueue>) => res.data,
      providesTags: ["AdminPayout"],
    }),

    decidePayout: build.mutation<
      { id: string; status: string },
      { id: string; decision: "approve" | "reject"; failure_reason?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/payouts/${id}`, method: "PATCH", body }),
      transformResponse: (res: ApiEnvelope<{ id: string; status: string }>) => res.data,
      invalidatesTags: ["AdminPayout", "AdminDashboard"],
    }),

    /* ------------------------------- Settings ------------------------------ */

    getSettings: build.query<PlatformSetting[], void>({
      query: () => ({ url: "/settings", method: "GET" }),
      transformResponse: (res: ApiEnvelope<PlatformSetting[]>) => res.data,
      providesTags: ["AdminSetting"],
    }),

    updateSetting: build.mutation<PlatformSetting, { key: string; value: number }>({
      query: ({ key, value }) => ({ url: `/settings/${key}`, method: "PATCH", body: { value } }),
      transformResponse: (res: ApiEnvelope<PlatformSetting>) => res.data,
      invalidatesTags: ["AdminSetting"],
    }),

    resetSetting: build.mutation<PlatformSetting, string>({
      query: (key) => ({ url: `/settings/${key}`, method: "DELETE" }),
      transformResponse: (res: ApiEnvelope<PlatformSetting>) => res.data,
      invalidatesTags: ["AdminSetting"],
    }),
  }),
});

export const {
  useAdminLoginMutation,
  useAdminVerifyMutation,
  useAdminSessionQuery,
  useAdminLogoutMutation,
  useGetAdminDashboardQuery,
  useGetAdminAnalyticsQuery,
  useGetVerificationsQuery,
  useGetVerificationQuery,
  useDecideVerificationMutation,
  useGetModerationShiftsQuery,
  useDecideShiftMutation,
  useGetAdminUsersQuery,
  useGetAdminUserQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useGetAdminDisputesQuery,
  useRuleDisputeMutation,
  useGetAdminPayoutsQuery,
  useDecidePayoutMutation,
  useGetSettingsQuery,
  useUpdateSettingMutation,
  useResetSettingMutation,
} = adminApi;
