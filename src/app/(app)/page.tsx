"use client";

import { Home } from "lucide-react";

import ScreenPlaceholder from "@/components/common/ScreenPlaceholder";
import { useAppSelector } from "@/store/hooks";

export default function HomePage() {
  const user = useAppSelector((s) => s.auth.user);
  const name = user?.full_name?.split(" ")[0];

  return (
    <ScreenPlaceholder
      icon={Home}
      title={name ? `Hi ${name} 👋` : "Home"}
      subtitle="Your shift opportunity feed lands here. Discover nearby work and apply in a tap."
    />
  );
}
