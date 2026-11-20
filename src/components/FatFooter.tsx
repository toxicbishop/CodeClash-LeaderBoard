import Link from 'next/link';

interface FatFooterProps {
  currentCompetitionSlug?: string;
}

export function FatFooter({ currentCompetitionSlug }: FatFooterProps) {
  const currentYear = 2026;

  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand & Overview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Code Clash 2026
              </span>
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Leaderboard Arena
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              Official leaderboard and competition platform for Code Clash 2026.
              Connecting contestants, lab administrators, and spectators with consolidated,
              transparent contest standings.
            </p>
          </div>

          {/* Column 1: Contest Arena */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Contest Arena
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/leaderboard"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Live Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Contest Overview
                </Link>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Auditorium Projector View
                </span>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Top-K Qualifier Standings
                </span>
              </li>
            </ul>
          </div>

          {/* Column 2: Portals & Access */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Portals
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Competition Administrator
                </Link>
              </li>
              <li>
                <Link
                  href="/lab-admin"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Lab Administrator Portal
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/competitions"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Manage Competitions
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Policies & Rules
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Fair Play & Code of Conduct
                </span>
              </li>
              <li>
                <span className="text-zinc-500 dark:text-zinc-500">
                  Tiebreaking Criteria
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
          <div>
            &copy; {currentYear} Code Clash Leaderboard System. All rights reserved.
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <span>Official Event Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}