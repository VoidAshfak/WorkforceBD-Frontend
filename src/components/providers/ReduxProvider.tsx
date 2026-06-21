"use client";

import { useState } from "react";
import { Provider } from "react-redux";

import { makeStore } from "@/store/store";

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  // One store instance per client, created once (SSR-safe via lazy initializer).
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
