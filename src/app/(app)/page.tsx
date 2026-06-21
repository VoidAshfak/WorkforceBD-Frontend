import { Home } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";

export default function HomePage() {
  return (
    <ScreenPlaceholder
      icon={Home}
      title="Home"
      subtitle="Your shift opportunity feed lands here. Discover nearby work and apply in a tap."
    />
  );
}
