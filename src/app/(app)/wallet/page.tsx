import { Wallet } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

export default function WalletPage() {
  return (
    <ScreenPlaceholder
      icon={Wallet}
      title="Wallet"
      subtitle="See your balance, earnings, and payout history. Withdraw to bKash or Nagad."
    />
  );
}
