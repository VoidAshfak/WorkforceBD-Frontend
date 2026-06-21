import BottomNav from "@/components/navigation/BottomNav";

/**
 * Mobile app shell. Centers content in a phone-width column and pins the
 * universal bottom navigation. `pb-16` keeps content clear of the fixed nav.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
