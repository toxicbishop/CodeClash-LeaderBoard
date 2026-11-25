import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: '404 — Page Not Found | Code Clash Leaderboard',
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Code Clash 2026
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">404</span>
          </div>

          <Link
            href="/leaderboard"
            className="text-xs font-medium px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Live leaderboard &rarr;
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-10 shadow-sm">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            ERROR 404
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Page not found
          </h1>

          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            The route or resource you requested doesn&apos;t exist, was moved, or is no longer active.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              View live leaderboard &rarr;
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              &larr; Back to sign in
            </Link>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
