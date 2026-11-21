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
                Code Clash 2026
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Score Consolidation
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              Consolidated scoring engine for Code Clash 2026. Ingests submissions across lab contest sets, resolves multi-set tiebreakers, and calculates cutoffs and qualifier standings.
            </p>
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
              <li>
                <span className="text-zinc-400 dark:text-zinc-600">
                  Projector display
                </span>
              </li>
              <li>
                <span className="text-zinc-400 dark:text-zinc-600">
                  Qualification cutoffs
                </span>
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
                <span className="text-zinc-400 dark:text-zinc-600">
                  Fair play rules
                </span>
              </li>
              <li>
                <span className="text-zinc-400 dark:text-zinc-600">
                  Tiebreaking criteria
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            &copy; {currentYear} Code Clash Leaderboard System. All rights reserved.
          </div>

          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Terms & conditions
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Privacy policy
            </Link>
            <span>&bull;</span>
            <span>Scoring and rankings engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
