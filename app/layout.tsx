import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { PwaRegister } from "@/components/pwa-register";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";

import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sora",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "ISRC", "ISRC finder", "ISRC lookup", "ISRC search", "song ISRC code",
    "Spotify ISRC", "Spotify ISRC finder", "Instagram ISRC", "Instagram music ISRC",
    "IG music ISRC", "Reels music ISRC", "ISRC Sri Lanka", "ISRC Srilanka",
    "Spotify ISRC Sri Lanka", "Instagram music Sri Lanka", "IG music Srilanka",
    "Sinhala song ISRC", "Tamil song ISRC",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ISRC Finder",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  applicationName: "ISRC Finder",
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
