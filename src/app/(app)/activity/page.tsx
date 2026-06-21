import { Activity } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

export default function ActivityPage() {
  return (
    <ScreenPlaceholder
      icon={Activity}
      title="Activity"
      subtitle="Track your applications, upcoming shifts, and notifications in one place."
    />
  );
}
