import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import MobileDeviceBlocker from "@/components/MobileDeviceBlocker";

const sansFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const defaultUrl = process.env.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Code Clash Leaderboard",
    template: "%s | Code Clash Leaderboard",
  },
  description:
    "Centralized competition platform for Code Clash 2026, featuring live HackerRank API leaderboard syncing, automated data validation, and unified rankings.",
  applicationName: "Code Clash Leaderboard",
  authors: [{ name: "Code Clash Team" }],
  keywords: [
    "Code Clash",
    "Leaderboard",
    "Coding Competition",
    "HackerRank",
    "Competitive Programming",
    "Multi-lab Ranking",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Code Clash Leaderboard",
    title: "Code Clash Leaderboard — Centralized Competition Platform",
    description:
      "Real-time competition leaderboard featuring live HackerRank sync, multi-lab scoring, and Top-K qualifiers for Code Clash 2026.",
    images: [
      {
        url: "/Dashboard.png",
        width: 1200,
        height: 630,
        alt: "Code Clash Leaderboard Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Code Clash Leaderboard — Centralized Competition Platform",
    description:
      "Real-time competition leaderboard featuring live HackerRank sync, multi-lab scoring, and Top-K qualifiers for Code Clash 2026.",
    images: ["/Dashboard.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${sansFont.variable} ${monoFont.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <MobileDeviceBlocker />
        {children}
      </body>
    </html>
  );
}
