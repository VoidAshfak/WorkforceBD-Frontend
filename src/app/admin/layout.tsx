import type { Metadata } from "next";

/**
 * Admin surface root. Keeps the console out of search indexes and off the
 * mobile `PhoneFrame` shell — everything below this is desktop-width.
 */
export const metadata: Metadata = {
  title: "WorkforceBD Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
