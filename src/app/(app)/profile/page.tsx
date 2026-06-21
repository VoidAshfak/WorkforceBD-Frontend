import { User } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

export default function ProfilePage() {
  return (
    <ScreenPlaceholder
      icon={User}
      title="Profile"
      subtitle="Your reputation, verification badges, skills, and account settings live here."
    />
  );
}
