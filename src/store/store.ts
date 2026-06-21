import { configureStore } from "@reduxjs/toolkit";

import { authApi } from "@/store/api/authApi";
import { workerApi } from "@/store/api/workerApi";
import authReducer from "@/store/slices/authSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [authApi.reducerPath]: authApi.reducer,
      [workerApi.reducerPath]: workerApi.reducer,
    },
    middleware: (getDefault) =>
      getDefault().concat(authApi.middleware, workerApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
