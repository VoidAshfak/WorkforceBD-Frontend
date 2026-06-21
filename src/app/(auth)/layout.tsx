/** Centered phone-width shell for the unauthenticated auth screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6">
      {children}
    </div>
  );
}
