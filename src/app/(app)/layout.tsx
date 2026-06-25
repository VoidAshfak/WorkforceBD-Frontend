import AppHeader from "@/components/navigation/AppHeader";
import BottomNav from "@/components/navigation/BottomNav";
import SessionGate from "@/components/auth/SessionGate";
import NotificationSocket from "@/components/notifications/NotificationSocket";

/**
 * Mobile app shell. Centers content in a phone-width column with a universal top
 * app bar and bottom navigation; `main` is the single scroll region between them
 * so the header and nav stay pinned. Immersive screens hide the chrome themselves.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <SessionGate>
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </main>
        <BottomNav />
        <NotificationSocket />
      </SessionGate>
    </div>
  );
}
