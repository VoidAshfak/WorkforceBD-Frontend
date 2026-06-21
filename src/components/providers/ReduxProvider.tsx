"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";

import { makeStore } from "@/store/store";

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  // One store instance per client, created once (SSR-safe via lazy initializer).
  const [store] = useState(makeStore);

  // Enables RTK Query refetchOnFocus / refetchOnReconnect across all APIs.
  useEffect(() => setupListeners(store.dispatch), [store]);

  return <Provider store={store}>{children}</Provider>;
}
