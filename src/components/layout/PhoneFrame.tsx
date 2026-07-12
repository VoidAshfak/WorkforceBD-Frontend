/**
 * Mobile shell for the worker/business app: a phone-width column floating on a
 * muted backdrop, and the single scroll container the app chrome pins itself to.
 *
 * It lives here rather than in the root layout because the admin dashboard
 * (`/admin`) is a desktop surface and must fill the viewport instead.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-[#e9e9ec] py-3">
      <div className="relative h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-border bg-background shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        {children}
      </div>
    </div>
  );
}
