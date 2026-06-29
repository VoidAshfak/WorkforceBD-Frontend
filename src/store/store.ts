import { configureStore } from "@reduxjs/toolkit";

import { authApi } from "@/store/api/authApi";
import { workerApi } from "@/store/api/workerApi";
import { shiftsApi } from "@/store/api/shiftsApi";
import { businessApi } from "@/store/api/businessApi";
import { notificationsApi } from "@/store/api/notificationsApi";
import { chatApi } from "@/store/api/chatApi";
import authReducer from "@/store/slices/authSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [authApi.reducerPath]: authApi.reducer,
      [workerApi.reducerPath]: workerApi.reducer,
      [shiftsApi.reducerPath]: shiftsApi.reducer,
      [businessApi.reducerPath]: businessApi.reducer,
      [notificationsApi.reducerPath]: notificationsApi.reducer,
      [chatApi.reducerPath]: chatApi.reducer,
    },
    middleware: (getDefault) =>
      getDefault().concat(
        authApi.middleware,
        workerApi.middleware,
        shiftsApi.middleware,
        businessApi.middleware,
        notificationsApi.middleware,
        chatApi.middleware,
      ),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
