import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/components/providers/ReduxProvider";

// BumbleSans (per DESIGN.md) is proprietary; Plus Jakarta Sans is the closest
// free, rounded geometric sans. Wired through the --font-app-sans token.
const appSans = Plus_Jakarta_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkforceBD",
  description: "Real-time workforce marketplace for Bangladesh.",
};

export const viewport: Viewport = {
  themeColor: "#FFDB5B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${appSans.variable} h-full antialiased`}>
      {/* Muted backdrop frames the phone-width column like a floating device.
          The frame is the single scroll container; the bottom nav sticks to it. */}
      <body className="flex min-h-dvh justify-center bg-[#e9e9ec] py-3">
        <ReduxProvider>
          <div className="relative h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-border bg-background shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
            {children}
          </div>
        </ReduxProvider>
      </body>
    </html>
  );
}
