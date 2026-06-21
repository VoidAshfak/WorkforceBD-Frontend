/** Centered phone-width shell for the unauthenticated auth screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full flex-col px-6">
      {children}
    </div>
  );
}
