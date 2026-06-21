"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useGetMeQuery } from "@/store/api/authApi";

/**
 * Hydrates the Redux session from the BFF on app entry. If the cookie session
 * is dead the BFF returns 401 and we bounce to the welcome screen.
 */
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isError } = useGetMeQuery();

  useEffect(() => {
    if (isError) router.replace("/welcome");
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" />
      </div>
    );
  }

  if (isError) return null;

  return <>{children}</>;
}
