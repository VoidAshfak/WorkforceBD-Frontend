import SessionGate from "@/components/auth/SessionGate";

/**
 * Full-screen shell for the onboarding wizard — phone-width, no bottom nav, so
 * the flow feels immersive. `SessionGate` guarantees an authenticated session
 * (bounces guests to /welcome) before the wizard reads the profile from Redux.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <SessionGate>{children}</SessionGate>
    </div>
  );
}
