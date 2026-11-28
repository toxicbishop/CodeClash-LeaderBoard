import Link from 'next/link';

interface FatFooterProps {
  currentCompetitionSlug?: string;
}

export function FatFooter({ currentCompetitionSlug }: FatFooterProps = {}) {
  const currentYear = 2026;
  const leaderboardHref = currentCompetitionSlug
    ? `/leaderboard?comp=${currentCompetitionSlug}`
    : '/leaderboard';

  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand & Overview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                Code Clash
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Score Consolidation
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              Consolidated scoring engine for Code Clash. Ingests submissions across lab contest sets, resolves multi-set tiebreakers, and calculates cutoffs and qualifier standings.
            </p>

            {/* Social Media Handles */}
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://www.linkedin.com/in/kssem-csbs-admin-b530232b5/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                title="LinkedIn — KSSEM CSBS"
                className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect width="4" height="12" x="2" y="9" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/kssem_csbs/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                title="Instagram — @kssem_csbs"
                className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                title="X"
                className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 1: Leaderboard */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Leaderboard
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href={leaderboardHref}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Live standings
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Contest overview
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Portals
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Competition administrator
                </Link>
              </li>
              <li>
                <Link
                  href="/lab-admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Lab administrator portal
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/competitions"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Manage competitions
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Policies
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Terms & conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link
                  href="/fair-play"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Fair play rules
                </Link>
              </li>
              <li>
                <Link
                  href="/tiebreakers"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Tiebreaking criteria
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            &copy; {currentYear} Code Clash Leaderboard System. All rights reserved.
          </div>

          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Terms & conditions
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Privacy policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
