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

const defaultUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://code-clash-leaderboard.vercel.app');

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Code Clash Leaderboard",
    template: "%s | Code Clash Leaderboard",
  },
  description:
    "Centralized competition platform for Code Clash 2026, featuring live HackerRank API leaderboard syncing, automated data validation, and unified rankings.",
  applicationName: "Code Clash Leaderboard",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
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
    url: "https://code-clash-leaderboard.vercel.app",
    siteName: "Code Clash Leaderboard",
    title: "Code Clash Leaderboard — Centralized Competition Platform",
    description:
      "Real-time competition leaderboard featuring live HackerRank sync, multi-lab scoring, and Top-K qualifiers for Code Clash 2026.",
  },
  twitter: {
    card: "summary",
    title: "Code Clash Leaderboard — Centralized Competition Platform",
    description:
      "Real-time competition leaderboard featuring live HackerRank sync, multi-lab scoring, and Top-K qualifiers for Code Clash 2026.",
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
