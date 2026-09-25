import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Instagram ISRC Finder",
  description: "Search quickly for recording ISRCs with MusicBrainz and Spotify.",
  applicationName: "Instagram ISRC Finder",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "ISRC Finder",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={sora.className}>
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
