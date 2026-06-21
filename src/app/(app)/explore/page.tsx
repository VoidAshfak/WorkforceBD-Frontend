import { Compass } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

export default function ExplorePage() {
  return (
    <ScreenPlaceholder
      icon={Compass}
      title="Explore"
      subtitle="Browse shifts on the map and in list view. Filter by zone, pay, and urgency."
    />
  );
}
