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
      {/* Neutral shell. The mobile app wraps itself in <PhoneFrame>; the admin
          dashboard is a desktop surface and fills the viewport. */}
      <body className="min-h-dvh bg-background">
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
