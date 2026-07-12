import PhoneFrame from "@/components/layout/PhoneFrame";

/** Centered phone-width shell for the unauthenticated auth screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PhoneFrame>
      <div className="flex min-h-full w-full flex-col px-6">{children}</div>
    </PhoneFrame>
  );
}
