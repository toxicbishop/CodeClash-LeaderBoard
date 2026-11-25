import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

interface ErrorPageShellProps {
  code: '401' | '403' | '404';
  badge: string;
  title: string;
  description: string;
  tone: 'amber' | 'red' | 'indigo';
  showSignInLink?: boolean;
}

const TONE_CLASSES = {
  amber: {
    codeText: 'text-amber-500 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  red: {
    codeText: 'text-red-500 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  indigo: {
    codeText: 'text-zinc-500 dark:text-zinc-400',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
} as const;

export function ErrorPageShell({
  code,
  badge,
  title,
  description,
  tone,
  showSignInLink = false,
}: ErrorPageShellProps) {
  const styles = TONE_CLASSES[tone];

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
            <span className={`text-sm font-mono ${styles.codeText}`}>{code}</span>
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
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${styles.badge}`}
          >
            {badge}
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>

          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {description}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              View live leaderboard &rarr;
            </Link>
            {showSignInLink && (
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                &larr; Back to sign in
              </Link>
            )}
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
