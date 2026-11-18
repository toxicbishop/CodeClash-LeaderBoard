import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Clash Leaderboard",
  description: "The shared leaderboard for Code Clash 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
