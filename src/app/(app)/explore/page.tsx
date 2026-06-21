import { Map } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

/**
 * Explore — map-based shift discovery (browse nearby shifts on a map). Coming
 * soon; the swipe-deck discovery lives on Home (`/`).
 */
export default function ExplorePage() {
  return (
    <ScreenPlaceholder
      icon={Map}
      title="Map view"
      subtitle="Browse shifts around you on the map — coming soon. For now, swipe through shifts on Home."
    />
  );
}
