import BottomNav from "@/components/navigation/BottomNav";
import SessionGate from "@/components/auth/SessionGate";

/**
 * Mobile app shell. Centers content in a phone-width column and pins the
 * universal bottom navigation. `pb-16` keeps content clear of the fixed nav.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <SessionGate>
        <main className="flex-1">{children}</main>
        <BottomNav />
      </SessionGate>
    </div>
  );
}
