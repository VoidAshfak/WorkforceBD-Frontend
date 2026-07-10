"use client";

import BusinessWallet from "@/components/business/BusinessWallet";
import WorkerWallet from "@/components/wallet/WorkerWallet";
import { useAppSelector } from "@/store/hooks";

/**
 * Wallet — role-aware. Workers see earnings + withdrawals; business accounts see
 * their escrow-funding wallet + top-ups. Both read/write only via the BFF.
 */
export default function WalletPage() {
  const activeRole = useAppSelector((s) => s.auth.activeRole);

  if (activeRole === "business") return <BusinessWallet />;

  return <WorkerWallet />;
}
