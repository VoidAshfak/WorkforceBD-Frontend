"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import NotificationBell from "@/components/notifications/NotificationBell";
import ChatInboxButton from "@/components/chat/ChatInboxButton";

/** Top-level tabs show the brand mark; everything else gets a back button. */
const TABS = new Set(["/", "/explore", "/activity", "/wallet", "/profile", "/chat"]);

/** Immersive screens render their own header — skip the global one. */
function isHidden(pathname: string): boolean {
  return pathname.startsWith("/chat/") || pathname.startsWith("/profile/edit");
}

/**
 * Universal mobile app bar pinned to the top of the shell on every screen:
 * brand mark on tabs (or a back button on sub-screens) + persistent Messages
 * and Notifications actions with their live badges. Hidden on immersive screens
 * (chat thread, profile editor) that supply their own header.
 */
export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  if (isHidden(pathname)) return null;
  const isTab = TABS.has(pathname);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-surface/85 px-4 py-2.5 backdrop-blur-md">
      {isTab ? (
        <Link href="/" aria-label="WorkforceBD home" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-[15px] font-black text-ink shadow-sm">
            W
          </span>
          <span className="text-[16px] font-extrabold tracking-tight text-ink">WorkforceBD</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      <div className="flex items-center gap-2">
        <ChatInboxButton />
        <NotificationBell />
      </div>
    </header>
  );
}
