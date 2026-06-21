import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { authApi } from "@/store/api/authApi";
import type { ProfileSummary, AuthUser } from "@/types/auth";
import type { Role } from "@/lib/validation/auth";

type SessionStatus = "idle" | "authenticated" | "unauthenticated";

type AuthState = {
  status: SessionStatus;
  user: AuthUser | null;
  activeRole: Role | null;
  profile: ProfileSummary | null;
  /** Login intent carried from the role/phone screen to the OTP screen. */
  pending: { phone: string; role: Role } | null;
};

const initialState: AuthState = {
  status: "idle",
  user: null,
  activeRole: null,
  profile: null,
  pending: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setPending(state, action: PayloadAction<{ phone: string; role: Role }>) {
      state.pending = action.payload;
    },
    clearPending(state) {
      state.pending = null;
    },
    clearSession(state) {
      state.status = "unauthenticated";
      state.user = null;
      state.activeRole = null;
      state.profile = null;
    },
  },
  extraReducers: (builder) => {
    const authed = (
      state: AuthState,
      action: PayloadAction<{ user: AuthUser; active_role: Role | null; profile: ProfileSummary | null }>,
    ) => {
      state.status = "authenticated";
      state.user = action.payload.user;
      state.activeRole = action.payload.active_role;
      state.profile = action.payload.profile;
      state.pending = null;
    };

    builder
      .addMatcher(authApi.endpoints.verifyOtp.matchFulfilled, authed)
      .addMatcher(authApi.endpoints.getMe.matchFulfilled, authed)
      .addMatcher(authApi.endpoints.getMe.matchRejected, (state) => {
        if (state.status === "idle") state.status = "unauthenticated";
      })
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.status = "unauthenticated";
        state.user = null;
        state.activeRole = null;
        state.profile = null;
      });
  },
});

export const { setPending, clearPending, clearSession } = authSlice.actions;
export default authSlice.reducer;
